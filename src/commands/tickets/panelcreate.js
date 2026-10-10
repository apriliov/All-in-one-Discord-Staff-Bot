const { ChannelType, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const TicketSettings = require('../../database/models/TicketSettings');
const TicketPanel = require('../../database/models/TicketPanel');
const { postPanel } = require('../../services/tickets');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'panelcreate',
  description: 'Create a ticket panel (with a first topic) in a channel.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'channel', type: 'channel', description: 'Channel to post the panel in', required: true, channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
    { name: 'title', type: 'string', description: 'Panel title (default: Support Tickets)', maxLength: 200 },
  ],
  async run(ctx, args) {
    const problem = canPostIn(ctx, args.channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });
    if (!args.channel.permissionsFor(ctx.guild.members.me)?.has(PermissionFlagsBits.EmbedLinks)) {
      return ctx.reply({ embeds: [embeds.error('I need the **Embed Links** permission in that channel.')] });
    }

    const counter = await TicketSettings.findOneAndUpdate({ guildId: ctx.guild.id }, { $inc: { panelCounter: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const data = {
      guildId: ctx.guild.id,
      panelId: counter.panelCounter,
      channelId: args.channel.id,
      topics: [{ key: 'support', label: 'Open a ticket', emoji: '🎫', description: 'Contact the staff team' }],
    };
    if (args.title) data.title = args.title.trim();
    const panel = await TicketPanel.create(data);

    try {
      await postPanel(ctx.guild, panel, args.channel);
    } catch (err) {
      await TicketPanel.deleteOne({ _id: panel._id });
      throw err;
    }

    await logEvent(ctx, 'Ticket panel created', `Panel #${panel.panelId} in <#${args.channel.id}>`);
    return ctx.reply({
      embeds: [
        embeds.success(
          `Panel **#${panel.panelId}** created in <#${args.channel.id}> with one topic.\n` +
            `Customize it: \`{prefix}paneledit ${panel.panelId} description ...\`\n` +
            `Add topics: \`{prefix}topicadd ${panel.panelId} Billing\`\n` +
            'Set the category and logs: `{prefix}ticketsetup`'
        ),
      ],
    });
  },
};
