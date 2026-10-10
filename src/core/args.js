const { SlashCommandBuilder, InteractionContextType } = require('discord.js');

class UsageError extends Error {}

function usageOf(cmd) {
  const opts = (cmd.options || []).filter((o) => !o.slashOnly).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ');
  return `${cmd.name}${opts ? ` ${opts}` : ''}`;
}

function applyOptions(builder, options = []) {
  for (const opt of options) {
    const base = (o) => {
      o.setName(opt.name).setDescription(opt.description).setRequired(!!opt.required);
      return o;
    };
    switch (opt.type) {
      case 'string':
        builder.addStringOption((o) => {
          base(o);
          if (opt.maxLength) o.setMaxLength(opt.maxLength);
          if (opt.choices) o.addChoices(...opt.choices.map((c) => ({ name: c, value: c })));
          if (opt.autocomplete) o.setAutocomplete(true);
          return o;
        });
        break;
      case 'integer':
        builder.addIntegerOption((o) => {
          base(o);
          if (opt.min !== undefined) o.setMinValue(opt.min);
          if (opt.max !== undefined) o.setMaxValue(opt.max);
          return o;
        });
        break;
      case 'boolean':
        builder.addBooleanOption(base);
        break;
      case 'user':
        builder.addUserOption(base);
        break;
      case 'role':
        builder.addRoleOption(base);
        break;
      case 'attachment':
        builder.addAttachmentOption(base);
        break;
      case 'channel':
        builder.addChannelOption((o) => {
          base(o);
          if (opt.channelTypes) o.addChannelTypes(...opt.channelTypes);
          return o;
        });
        break;
      default:
        throw new Error(`Unknown option type "${opt.type}".`);
    }
  }
  return builder;
}

// A command can have "subcommands" for Discord's slash menu (/modmail welcome). The prefix version keeps
// using "options" (!modmail welcome ...). The chosen subcommand name is handed to run() as args[subKey].
const subKeyOf = (cmd) => cmd.subKey || 'action';

function buildSlashCommand(cmd) {
  const builder = new SlashCommandBuilder()
    .setName(cmd.name)
    .setDescription(cmd.description)
    .setContexts([InteractionContextType.Guild]);

  if (cmd.subcommands && cmd.subcommands.length) {
    for (const sub of cmd.subcommands) {
      builder.addSubcommand((s) => {
        s.setName(sub.name).setDescription(sub.description);
        applyOptions(s, sub.options);
        return s;
      });
    }
    return builder;
  }

  applyOptions(builder, cmd.options);
  return builder;
}

async function resolveSlashArgs(ctx, command) {
  const i = ctx.interaction;
  const args = {};
  let options = Array.isArray(command) ? command : command.options || [];

  if (!Array.isArray(command) && command.subcommands && command.subcommands.length) {
    const name = i.options.getSubcommand();
    const sub = command.subcommands.find((s) => s.name === name);
    args[subKeyOf(command)] = name;
    options = (sub && sub.options) || [];
  }

  for (const opt of options) {
    let value = null;
    switch (opt.type) {
      case 'string':
        value = i.options.getString(opt.name);
        break;
      case 'integer':
        value = i.options.getInteger(opt.name);
        break;
      case 'boolean':
        value = i.options.getBoolean(opt.name);
        break;
      case 'user':
        value = i.options.getUser(opt.name);
        break;
      case 'attachment':
        value = i.options.getAttachment(opt.name);
        break;
      case 'role': {
        const role = i.options.getRole(opt.name);
        value = role ? await ctx.guild.roles.fetch(role.id).catch(() => null) : null;
        break;
      }
      case 'channel': {
        const channel = i.options.getChannel(opt.name);
        value = channel ? await ctx.guild.channels.fetch(channel.id).catch(() => null) : null;
        break;
      }
    }
    if (value !== null && value !== undefined) args[opt.name] = value;
  }
  return args;
}

const TRUE_WORDS = ['true', 'yes', 'y', 'on', '1'];
const FALSE_WORDS = ['false', 'no', 'n', 'off', '0'];

function extractId(token, pattern) {
  const match = token.match(pattern);
  if (match) return match[1];
  return /^\d{17,20}$/.test(token) ? token : null;
}

async function convert(ctx, opt, token) {
  switch (opt.type) {
    case 'string':
      if (opt.choices && !opt.choices.includes(token.toLowerCase())) {
        throw new UsageError(`\`${opt.name}\` must be one of: ${opt.choices.join(', ')}.`);
      }
      if (opt.choices) return token.toLowerCase();
      if (opt.maxLength && token.length > opt.maxLength) {
        throw new UsageError(`\`${opt.name}\` is too long (max ${opt.maxLength} characters).`);
      }
      return token;
    case 'integer': {
      const n = Number(token);
      if (!Number.isInteger(n)) throw new UsageError(`\`${opt.name}\` must be a whole number.`);
      if (opt.min !== undefined && n < opt.min) throw new UsageError(`\`${opt.name}\` must be at least ${opt.min}.`);
      if (opt.max !== undefined && n > opt.max) throw new UsageError(`\`${opt.name}\` must be at most ${opt.max}.`);
      return n;
    }
    case 'boolean': {
      const word = token.toLowerCase();
      if (TRUE_WORDS.includes(word)) return true;
      if (FALSE_WORDS.includes(word)) return false;
      throw new UsageError(`\`${opt.name}\` must be true or false.`);
    }
    case 'user': {
      const id = extractId(token, /^<@!?(\d+)>$/);
      const user = id ? await ctx.client.users.fetch(id).catch(() => null) : null;
      if (!user) throw new UsageError('I could not find that user. Use a mention or a user ID.');
      return user;
    }
    case 'role': {
      const id = extractId(token, /^<@&(\d+)>$/);
      const role = id ? await ctx.guild.roles.fetch(id).catch(() => null) : null;
      if (!role) throw new UsageError('I could not find that role. Use a mention or a role ID.');
      return role;
    }
    case 'channel': {
      const id = extractId(token, /^<#(\d+)>$/);
      const channel = id ? await ctx.guild.channels.fetch(id).catch(() => null) : null;
      if (!channel) throw new UsageError('I could not find that channel. Use a mention or a channel ID.');
      if (opt.channelTypes && !opt.channelTypes.includes(channel.type)) {
        throw new UsageError('That channel type is not supported for this command.');
      }
      return channel;
    }
    default:
      throw new Error(`Unknown option type "${opt.type}".`);
  }
}

async function parsePrefixArgs(ctx, options = [], raw = '') {
  const args = {};
  const prefixOptions = options.filter((o) => !o.slashOnly);
  const consumers = prefixOptions.filter((o) => o.type !== 'attachment');
  const lastName = consumers.length ? consumers[consumers.length - 1].name : null;
  let rest = raw;

  for (const opt of prefixOptions) {
    if (opt.type === 'attachment') {
      const file = ctx.message.attachments.first();
      if (file) args[opt.name] = file;
      else if (opt.required) throw new UsageError(`Please attach a file for \`${opt.name}\`.`);
      continue;
    }

    let token = '';
    if (opt.type === 'string' && opt.name === lastName) {
      token = rest.trim();
      rest = '';
    } else {
      const match = rest.match(/^(\S+)\s*([\s\S]*)$/);
      if (match) {
        token = match[1];
        rest = match[2];
      }
    }

    if (!token) {
      if (opt.required) throw new UsageError(`Missing required argument \`${opt.name}\`.`);
      continue;
    }
    args[opt.name] = await convert(ctx, opt, token);
  }
  return args;
}

module.exports = { UsageError, usageOf, buildSlashCommand, resolveSlashArgs, parsePrefixArgs, subKeyOf };
