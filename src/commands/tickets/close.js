const embeds = require('../../utils/embeds');
const { findTicketByChannel, closeTicket } = require('../../services/modmail');
const { findSupportTicket, closeSupportTicket } = require('../../services/tickets');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = {
  name: 'close',
  aliases: ['ticketclose', 'tclose'],
  description: 'Close the ticket or modmail thread in this channel. A transcript is saved.',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'reason', type: 'string', description: 'Reason for closing (the user can see it)', maxLength: 500 }],
  async run(ctx, args) {
    const modmail = await findTicketByChannel(ctx.guild.id, ctx.channel.id);
    if (modmail) {
      await ctx.reply({ embeds: [embeds.info('🔒 Closing this ticket in 5 seconds. The transcript will be sent to your DMs.')] });
      await sleep(5000);
      return closeTicket(ctx.client, ctx.guild, modmail, { closedBy: ctx.user, reason: args.reason || null });
    }

    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });

    await ctx.reply({ embeds: [embeds.info('🔒 Closing this ticket in 5 seconds.')] });
    await sleep(5000);
    return closeSupportTicket(ctx.client, ctx.guild, ticket, { closedBy: ctx.user, reason: args.reason || null });
  },
};
