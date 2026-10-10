const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const { togglePause } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'gpause',
  aliases: ['gresume'],
  description: 'Pause a running giveaway, or resume a paused one.',
  category: 'Giveaways',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 }],
  async run(ctx, args) {
    const g = await Giveaway.findOne({ guildId: ctx.guild.id, giveawayId: args.id });
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });
    if (g.status === 'ended') return ctx.reply({ embeds: [embeds.error('That giveaway already ended.')] });

    const updated = await togglePause(ctx.client, g);
    if (!updated) return ctx.reply({ embeds: [embeds.error('The giveaway changed state, please try again.')] });
    const paused = updated.status === 'paused';
    await logEvent(ctx, paused ? 'Giveaway paused' : 'Giveaway resumed', `#${g.giveawayId}: **${g.prize}**`);
    return ctx.reply({ embeds: [embeds.success(paused ? `Giveaway **#${g.giveawayId}** is paused. The timer is frozen.` : `Giveaway **#${g.giveawayId}** resumed. It ends <t:${Math.floor(updated.endsAt.getTime() / 1000)}:R>.`)] });
  },
};
