const embeds = require('../../utils/embeds');
const { LEVELS } = require('../../core/permissions');
const { findSupportTicket, setClaim } = require('../../services/tickets');

module.exports = {
  name: 'claim',
  description: 'Claim the ticket in this channel.',
  category: 'Tickets',
  level: 'helper',
  async run(ctx) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    if (ticket.claimedBy === ctx.user.id) return ctx.reply({ embeds: [embeds.error('You already claimed this ticket.')] });
    if (ticket.claimedBy && ctx.level < LEVELS.admin) return ctx.reply({ embeds: [embeds.error(`This ticket is already claimed by <@${ticket.claimedBy}>.`)] });

    await setClaim(ctx.client, ctx.guild, ticket, ctx.user.id);
    return ctx.reply({ embeds: [embeds.info(`🙋 <@${ctx.user.id}> claimed this ticket.`)] });
  },
};
