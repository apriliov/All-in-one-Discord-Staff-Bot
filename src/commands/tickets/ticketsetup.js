const { ChannelType, EmbedBuilder } = require('discord.js');
const config = require('../../config');
const embeds = require('../../utils/embeds');
const TicketSettings = require('../../database/models/TicketSettings');
const { getSettings } = require('../../services/tickets');
const { logEvent } = require('../../services/cases');
const { roleId, channelId, parseToggle, isNone } = require('../../utils/parse');

const ACTIONS = ['show', 'category', 'logs', 'role', 'limit', 'claim', 'feedback', 'transcript', 'userclose', 'ping', 'autoclose', 'naming'];
const onOff = (v) => (v ? 'on' : 'off');

module.exports = {
  name: 'ticketsetup',
  description: 'Configure the ticket system (category, logs, support roles, limits, options).',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'action', type: 'string', description: 'Setting to change, or show', choices: ACTIONS },
    { name: 'value', type: 'string', description: 'New value (channel, role, number, on/off, "none")', maxLength: 100 },
  ],
  subcommands: [
    { name: 'show', description: 'Show the current ticket settings.' },
    { name: 'category', description: 'Category where new tickets are created.', options: [{ name: 'value', type: 'string', description: 'Category ID, or "none" to clear it.', required: true, maxLength: 100 }] },
    { name: 'logs', description: 'Channel for ticket logs and transcripts.', options: [{ name: 'value', type: 'string', description: 'Channel mention or ID, or "none" to use the staff log channel.', required: true, maxLength: 100 }] },
    { name: 'role', description: 'Add or remove a support role.', options: [{ name: 'value', type: 'string', description: 'Role mention or ID (use it again to remove it), or "none" to clear all.', required: true, maxLength: 100 }] },
    { name: 'limit', description: 'Max open tickets per user.', options: [{ name: 'value', type: 'integer', description: 'Number from 1 to 25.', required: true, min: 1, max: 25 }] },
    { name: 'claim', description: 'Turn the Claim button on or off.', options: [{ name: 'value', type: 'boolean', description: 'True = on, false = off.', required: true }] },
    { name: 'feedback', description: 'Ask for a rating after a ticket closes.', options: [{ name: 'value', type: 'boolean', description: 'True = on, false = off.', required: true }] },
    { name: 'transcript', description: 'DM the transcript to the ticket owner when it closes.', options: [{ name: 'value', type: 'boolean', description: 'True = on, false = off.', required: true }] },
    { name: 'userclose', description: 'Let the ticket owner close their own ticket.', options: [{ name: 'value', type: 'boolean', description: 'True = on, false = off.', required: true }] },
    { name: 'ping', description: 'Ping the support roles when a ticket opens.', options: [{ name: 'value', type: 'boolean', description: 'True = on, false = off.', required: true }] },
    { name: 'autoclose', description: 'Close tickets automatically after some inactivity.', options: [{ name: 'value', type: 'integer', description: 'Hours without messages (1-720). 0 turns it off.', required: true, min: 0, max: 720 }] },
    { name: 'naming', description: 'Pattern for ticket channel names.', options: [{ name: 'value', type: 'string', description: 'Must contain {number}. Also {user} and {topic}. Example: ticket-{number}', required: true, maxLength: 60 }] },
  ],
  async run(ctx, args) {
    const action = args.action || 'show';
    const value = String(args.value ?? '').trim();
    const guildId = ctx.guild.id;
    const settings = await getSettings(guildId);
    const set = (data) => TicketSettings.updateOne({ guildId }, data);
    const done = async (text) => {
      await logEvent(ctx, 'Ticket setup changed', text);
      return ctx.reply({ embeds: [embeds.success(text)] });
    };
    const needValue = () => ctx.reply({ embeds: [embeds.error(`Please give a value. Example: \`{prefix}ticketsetup ${action} <value>\``)] });

    if (action === 'show') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.brand)
        .setTitle('Ticket settings')
        .addFields(
          { name: 'Ticket category', value: settings.categoryId ? `<#${settings.categoryId}>` : 'Not set (tickets are created without a category)', inline: true },
          { name: 'Log channel', value: settings.logChannelId ? `<#${settings.logChannelId}>` : 'Staff log channel', inline: true },
          { name: 'Support roles', value: settings.supportRoleIds.length ? settings.supportRoleIds.map((id) => `<@&${id}>`).join(' ') : 'Helper + admin roles', inline: true },
          { name: 'Max open per user', value: String(settings.maxOpen), inline: true },
          { name: 'Claim button', value: onOff(settings.claim), inline: true },
          { name: 'Rating after close', value: onOff(settings.feedback), inline: true },
          { name: 'DM transcript', value: onOff(settings.dmTranscript), inline: true },
          { name: 'User can close', value: onOff(settings.allowUserClose), inline: true },
          { name: 'Ping support', value: onOff(settings.pingSupport), inline: true },
          { name: 'Auto-close', value: settings.autoCloseHours ? `${settings.autoCloseHours}h without activity` : 'off', inline: true },
          { name: 'Channel name', value: `\`${settings.namePattern}\``, inline: true }
        )
        .setFooter({ text: 'Change with: {prefix}ticketsetup <setting> <value>' });
      return ctx.reply({ embeds: [embed] });
    }

    switch (action) {
      case 'category': {
        if (!value) return needValue();
        if (isNone(value)) {
          await set({ categoryId: null });
          return done('Ticket category cleared.');
        }
        const id = channelId(value);
        const channel = id ? await ctx.guild.channels.fetch(id).catch(() => null) : null;
        if (!channel || channel.type !== ChannelType.GuildCategory) return ctx.reply({ embeds: [embeds.error('Give me a **category** ID (enable developer mode, right click the category, Copy ID).')] });
        await set({ categoryId: channel.id });
        return done(`New tickets are created in **${channel.name}**.`);
      }
      case 'logs': {
        if (!value) return needValue();
        if (isNone(value)) {
          await set({ logChannelId: null });
          return done('Ticket logs now go to the staff log channel.');
        }
        const id = channelId(value);
        const channel = id ? await ctx.guild.channels.fetch(id).catch(() => null) : null;
        if (!channel || !channel.isTextBased()) return ctx.reply({ embeds: [embeds.error('That is not a text channel.')] });
        await set({ logChannelId: channel.id });
        return done(`Ticket logs and transcripts go to <#${channel.id}>.`);
      }
      case 'role': {
        if (!value) return needValue();
        if (isNone(value)) {
          await set({ supportRoleIds: [] });
          return done('Support roles cleared. Helper and admin roles are used.');
        }
        const id = roleId(value);
        const role = id ? await ctx.guild.roles.fetch(id).catch(() => null) : null;
        if (!role) return ctx.reply({ embeds: [embeds.error('I could not find that role. Use a mention or a role ID.')] });
        const has = settings.supportRoleIds.includes(role.id);
        await set(has ? { $pull: { supportRoleIds: role.id } } : { $addToSet: { supportRoleIds: role.id } });
        return done(has ? `${role} is no longer a support role.` : `${role} is now a support role.`);
      }
      case 'limit': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 25) return ctx.reply({ embeds: [embeds.error('The limit must be a number from 1 to 25.')] });
        await set({ maxOpen: n });
        return done(`Each user can have up to **${n}** open ticket(s).`);
      }
      case 'claim':
      case 'feedback':
      case 'transcript':
      case 'userclose':
      case 'ping': {
        const on = parseToggle(value);
        if (on === null) return ctx.reply({ embeds: [embeds.error('Use `on` or `off`.')] });
        const field = { claim: 'claim', feedback: 'feedback', transcript: 'dmTranscript', userclose: 'allowUserClose', ping: 'pingSupport' }[action];
        await set({ [field]: on });
        return done(`**${action}** is now **${onOff(on)}**.`);
      }
      case 'autoclose': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 0 || n > 720) return ctx.reply({ embeds: [embeds.error('Give the hours of inactivity (1-720), or `0` to turn it off.')] });
        await set({ autoCloseHours: n || null });
        return done(n ? `Tickets close automatically after **${n}h** without messages.` : 'Auto-close is off.');
      }
      case 'naming': {
        if (!/\{number\}/i.test(value)) return ctx.reply({ embeds: [embeds.error('The pattern must contain `{number}`. Other variables: `{user}`, `{topic}`. Example: `ticket-{number}`')] });
        await set({ namePattern: value.slice(0, 60) });
        return done(`Ticket channels are now named \`${value.slice(0, 60)}\`.`);
      }
      default:
        return ctx.reply({ embeds: [embeds.error(`Unknown setting. Choose one of: ${ACTIONS.join(', ')}.`)] });
    }
  },
};
