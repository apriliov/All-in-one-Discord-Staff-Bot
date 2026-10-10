const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const SupportTicket = require('../../database/models/SupportTicket');
const embeds = require('../../utils/embeds');
const { PRIORITIES, pad } = require('../../services/tickets');
const { truncate } = require('../../utils/format');

module.exports = {
  name: 'ticketlist',
  aliases: ['opentickets'],
  description: 'List the open support tickets.',
  category: 'Tickets',
  level: 'helper',
  async run(ctx) {
    const tickets = await SupportTicket.find({ guildId: ctx.guild.id, status: 'open' }).sort({ number: 1 }).limit(25).lean();
    if (!tickets.length) return ctx.reply({ embeds: [embeds.info('There are no open tickets.')] });
    const lines = tickets.map((t) => {
      const p = PRIORITIES[t.priority] || PRIORITIES.normal;
      return `${p.emoji} <#${t.channelId}> • #${pad(t.number)} • ${truncate(t.topicLabel, 30)} • <@${t.userId}> • ${t.claimedBy ? `🙋 <@${t.claimedBy}>` : 'unclaimed'}`;
    });
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(config.colors.brand).setTitle(`Open tickets (${tickets.length})`).setDescription(truncate(lines.join('\n'), 4000))] });
  },
};
