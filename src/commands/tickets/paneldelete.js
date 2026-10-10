const embeds = require('../../utils/embeds');
const TicketPanel = require('../../database/models/TicketPanel');
const { getPanel } = require('../../services/ticketAdmin');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'paneldelete',
  description: 'Delete a ticket panel and its message. Open tickets stay open.',
  category: 'Tickets',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Panel number', required: true, min: 1 }],
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.id);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.id} was not found.`)] });

    const channel = panel.channelId ? await ctx.guild.channels.fetch(panel.channelId).catch(() => null) : null;
    const message = channel && panel.messageId ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
    if (message) await message.delete().catch(() => {});
    await TicketPanel.deleteOne({ _id: panel._id });

    await logEvent(ctx, 'Ticket panel deleted', `Panel #${panel.panelId}`);
    return ctx.reply({ embeds: [embeds.success(`Panel **#${panel.panelId}** was deleted.`)] });
  },
};
