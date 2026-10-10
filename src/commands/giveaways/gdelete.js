const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const { fetchGiveawayMessage } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'gdelete',
  aliases: ['gcancel'],
  description: 'Delete a giveaway and its message. No winners are picked.',
  category: 'Giveaways',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 }],
  async run(ctx, args) {
    const g = await Giveaway.findOneAndDelete({ guildId: ctx.guild.id, giveawayId: args.id });
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });

    const message = await fetchGiveawayMessage(ctx.client, g);
    if (message) await message.delete().catch(() => {});
    await logEvent(ctx, 'Giveaway deleted', `#${g.giveawayId}: **${g.prize}** (${g.status})`);
    return ctx.reply({ embeds: [embeds.success(`Giveaway **#${g.giveawayId}** was deleted.`)] });
  },
};
