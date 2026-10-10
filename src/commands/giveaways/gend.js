const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const { endGiveaway } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'gend',
  description: 'End a giveaway right now and pick the winners.',
  category: 'Giveaways',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 }],
  async run(ctx, args) {
    const g = await Giveaway.findOne({ guildId: ctx.guild.id, giveawayId: args.id });
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });
    if (g.status === 'ended') return ctx.reply({ embeds: [embeds.error('That giveaway already ended. Use `greroll` to pick new winners.')] });

    const ended = await endGiveaway(ctx.client, g);
    if (!ended) return ctx.reply({ embeds: [embeds.error('That giveaway already ended.')] });
    await logEvent(ctx, 'Giveaway ended early', `#${g.giveawayId}: **${g.prize}**`);
    const winners = ended.winners.length ? ended.winners.map((id) => `<@${id}>`).join(', ') : 'no valid entrants';
    return ctx.reply({ embeds: [embeds.success(`Giveaway **#${g.giveawayId}** ended. Winners: ${winners}`)] });
  },
};
