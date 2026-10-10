const embeds = require('../../utils/embeds');
const { findSupportTicket } = require('../../services/tickets');
const { slug } = require('../../utils/parse');

module.exports = {
  name: 'trename',
  aliases: ['ticketrename'],
  description: 'Rename the ticket channel (Discord allows 2 renames per 10 minutes).',
  category: 'Tickets',
  level: 'helper',
  options: [{ name: 'name', type: 'string', description: 'New channel name', required: true, maxLength: 80 }],
  async run(ctx, args) {
    const ticket = await findSupportTicket(ctx.guild.id, ctx.channel.id);
    if (!ticket) return ctx.reply({ embeds: [embeds.error('This is not an open ticket channel.')] });
    const name = slug(args.name, 90);
    if (!name) return ctx.reply({ embeds: [embeds.error('Use letters or numbers in the name.')] });

    const timeout = new Promise((resolve) => setTimeout(() => resolve('timeout'), 8000));
    const result = await Promise.race([ctx.channel.setName(name, `Renamed by ${ctx.user.username}`).catch(() => 'error'), timeout]);
    if (result === 'timeout' || result === 'error') return ctx.reply({ embeds: [embeds.error('I could not rename the channel right now. Discord limits renames to 2 per 10 minutes.')] });
    return ctx.reply({ embeds: [embeds.success(`Channel renamed to **${name}**.`)] });
  },
};
