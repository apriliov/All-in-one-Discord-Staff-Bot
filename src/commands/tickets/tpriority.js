const embeds = require('../../utils/embeds');
const { findSupportTicket, setPriority, PRIORITIES } = require('../../services/tickets');

module.exports = {
  name: 'tpriority',
  aliases: ['priority'],
  description: 'Set the priority of the ticket: low, normal, high or urgent.',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'level', type: 'string', description: 'Priority level', required: true, choices: Object.keys(PRIORITIES) }],
  async run(ctx, args) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    await setPriority(ctx.client, ctx.guild, ticket, args.level);
    const p = PRIORITIES[args.level];
    return ctx.reply({ embeds: [embeds.info(`${p.emoji} Priority set to **${p.label}**.`)] });
  },
};
