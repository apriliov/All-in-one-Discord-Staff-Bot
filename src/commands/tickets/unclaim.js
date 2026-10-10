const embeds = require('../../utils/embeds');
const { LEVELS } = require('../../core/permissions');
const { findSupportTicket, setClaim } = require('../../services/tickets');

module.exports = {
  name: 'unclaim',
  description: 'Release your claim on the ticket in this channel.',
  category: 'Tickets',
  level: 'helper',
  async run(ctx) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    if (!ticket.claimedBy) return ctx.reply({ embeds: [embeds.error('Nobody has claimed this ticket.')] });
    if (ticket.claimedBy !== ctx.user.id && ctx.level < LEVELS.admin) return ctx.reply({ embeds: [embeds.error(`Only <@${ticket.claimedBy}> or an admin can unclaim this ticket.`)] });

    await setClaim(ctx.client, ctx.guild, ticket, null);
    return ctx.reply({ embeds: [embeds.info('🙋 This ticket is no longer claimed.')] });
  },
};
