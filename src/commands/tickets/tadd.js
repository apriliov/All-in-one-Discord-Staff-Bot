const embeds = require('../../utils/embeds');
const SupportTicket = require('../../database/models/SupportTicket');
const { findSupportTicket } = require('../../services/tickets');

module.exports = {
  name: 'tadd',
  aliases: ['adduser'],
  description: 'Add a user to the ticket in this channel.',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'user', type: 'user', description: 'User to add', required: true }],
  async run(ctx, args) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    const member = await ctx.guild.members.fetch(args.user.id).catch(() => null);
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });

    await ctx.channel.permissionOverwrites.edit(
      member.id,
      { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, EmbedLinks: true },
      { reason: `Added to ticket #${ticket.number} by ${ctx.user.username}` }
    );
    await SupportTicket.updateOne({ _id: ticket._id }, { $addToSet: { addedUsers: member.id } });
    return ctx.reply({ embeds: [embeds.success(`<@${member.id}> was added to this ticket.`)] });
  },
};
