const embeds = require('../../utils/embeds');
const SupportTicket = require('../../database/models/SupportTicket');
const { findSupportTicket } = require('../../services/tickets');

module.exports = {
  name: 'tremove',
  aliases: ['removeuser'],
  description: 'Remove a user from the ticket in this channel.',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'user', type: 'user', description: 'User to remove', required: true }],
  async run(ctx, args) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    if (args.user.id === ticket.userId) return ctx.reply({ embeds: [embeds.error('You cannot remove the ticket owner. Close the ticket instead.')] });

    await ctx.channel.permissionOverwrites.delete(args.user.id, `Removed from ticket #${ticket.number} by ${ctx.user.username}`).catch(() => {});
    await SupportTicket.updateOne({ _id: ticket._id }, { $pull: { addedUsers: args.user.id } });
    return ctx.reply({ embeds: [embeds.success(`<@${args.user.id}> was removed from this ticket.`)] });
  },
};
