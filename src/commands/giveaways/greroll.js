const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const { rerollGiveaway } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'greroll',
  aliases: ['reroll'],
  description: 'Pick new winner(s) for an ended giveaway.',
  category: 'Giveaways',
  level: 'admin',
  options: [
    { name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 },
    { name: 'winners', type: 'integer', description: 'How many new winners (default 1)', min: 1, max: 50 },
  ],
  async run(ctx, args) {
    const g = await Giveaway.findOne({ guildId: ctx.guild.id, giveawayId: args.id });
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });
    if (g.status !== 'ended') return ctx.reply({ embeds: [embeds.error('That giveaway has not ended yet. Use `gend` first.')] });

    const picked = await rerollGiveaway(ctx.client, ctx.guild, g, args.winners || 1);
    if (!picked.length) return ctx.reply({ embeds: [embeds.error('There are no more eligible entrants to pick from.')] });
    await logEvent(ctx, 'Giveaway rerolled', `#${g.giveawayId}: ${picked.map((id) => `<@${id}>`).join(', ')}`);
    return ctx.reply({ embeds: [embeds.success(`Rerolled giveaway **#${g.giveawayId}**. New winner(s): ${picked.map((id) => `<@${id}>`).join(', ')}`)] });
  },
};
