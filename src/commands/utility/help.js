const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config');
const { LEVELS, LEVEL_NAMES } = require('../../core/permissions');
const { usageOf } = require('../../core/args');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Show the commands you can use, or details about one command.',
  category: 'Utility',
  level: 'helper',
  ephemeral: true,
  options: [{ name: 'command', type: 'string', description: 'Command to get details for', maxLength: 32 }],
  async run(ctx, args) {
    const { commands, find } = ctx.client.registry;

    if (args.command) {
      const cmd = find(args.command.toLowerCase().replace(/^\//, ''));
      if (!cmd || ctx.level < LEVELS[cmd.level]) {
        return ctx.reply({ embeds: [embeds.error('I could not find that command.')] });
      }
      const embed = new EmbedBuilder()
        .setColor(colors.brand)
        .setTitle(`Command: ${cmd.name}`)
        .setDescription(cmd.description)
        .addFields(
          { name: 'Usage', value: `\`{prefix}${usageOf(cmd)}\`\n\`/${cmd.name}\`` },
          { name: 'Required level', value: cmd.level, inline: true },
          { name: 'Aliases', value: cmd.aliases.length ? cmd.aliases.map((a) => `\`${a}\``).join(', ') : 'None', inline: true }
        );
      for (const opt of cmd.options) {
        embed.addFields({ name: `${opt.required ? '<' : '['}${opt.name}${opt.required ? '>' : ']'}`, value: opt.description });
      }
      if (cmd.subcommands) {
        const lines = cmd.subcommands.map((s) => {
          const opts = (s.options || []).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(' ');
          return `\`/${cmd.name} ${s.name}${opts ? ` ${opts}` : ''}\``;
        });
        embed.addFields({ name: 'Slash subcommands', value: lines.join('\n').slice(0, 1024) });
      }
      return ctx.reply({ embeds: [embed.setFooter({ text: '<required>  [optional]' })] });
    }

    const groups = new Map();
    for (const cmd of commands.values()) {
      if (ctx.level < LEVELS[cmd.level]) continue;
      if (!groups.has(cmd.category)) groups.set(cmd.category, []);
      groups.get(cmd.category).push(`\`${cmd.name}\``);
    }

    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setTitle('Staff Helper Bot')
      .setDescription(
        `Your level: **${LEVEL_NAMES[ctx.level]}**\nUse slash commands or the prefix \`{prefix}\` (example: \`{prefix}warn @user spam\`).\nUse \`{prefix}help <command>\` for details.\nInside a ticket or modmail channel, \`{prefix}close\` closes it.`
      );
    for (const [category, names] of groups) {
      embed.addFields({ name: category, value: names.join(' ') });
    }
    return ctx.reply({ embeds: [embed] });
  },
};
