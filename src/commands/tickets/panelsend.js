const { ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { postPanel } = require('../../services/tickets');
const { getPanel } = require('../../services/ticketAdmin');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'panelsend',
  description: 'Post a ticket panel again (removes the old message). Use it if the message was deleted.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'id', type: 'integer', description: 'Panel number', required: true, min: 1 },
    { name: 'channel', type: 'channel', description: 'Channel (default: the panel channel)', channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement] },
  ],
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.id);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.id} was not found.`)] });

    const target = args.channel || (panel.channelId ? await ctx.guild.channels.fetch(panel.channelId).catch(() => null) : null) || ctx.channel;
    const problem = canPostIn(ctx, target);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    const oldChannel = panel.channelId ? await ctx.guild.channels.fetch(panel.channelId).catch(() => null) : null;
    const oldMessage = oldChannel && panel.messageId ? await oldChannel.messages.fetch(panel.messageId).catch(() => null) : null;
    const message = await postPanel(ctx.guild, panel, target);
    if (oldMessage) await oldMessage.delete().catch(() => {});

    await logEvent(ctx, 'Ticket panel sent', `Panel #${panel.panelId} in <#${target.id}>`);
    return ctx.reply({ embeds: [embeds.success(`Panel **#${panel.panelId}** posted in <#${target.id}>. [Jump](${message.url})`)] });
  },
};
