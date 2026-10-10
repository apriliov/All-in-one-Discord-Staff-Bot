const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const config = require('../../config');
const { jumpLink } = require('../../services/giveaways');
const { truncate } = require('../../utils/format');

module.exports = {
  name: 'glist',
  aliases: ['giveaways'],
  description: 'List the giveaways of this server.',
  category: 'Giveaways',
  level: 'helper',
  options: [{ name: 'status', type: 'string', description: 'active (default), ended or all', choices: ['active', 'ended', 'all'] }],
  async run(ctx, args) {
    const status = args.status || 'active';
    const filter = { guildId: ctx.guild.id };
    if (status === 'active') filter.status = { $in: ['active', 'paused'] };
    else if (status === 'ended') filter.status = 'ended';

    const list = await Giveaway.find(filter).sort({ giveawayId: -1 }).limit(15).lean();
    if (!list.length) return ctx.reply({ embeds: [new EmbedBuilder().setColor(config.colors.neutral).setDescription('No giveaways found.')] });

    const lines = list.map((g) => {
      const when =
        g.status === 'ended' ? `Ended <t:${Math.floor(new Date(g.endedAt || g.endsAt).getTime() / 1000)}:R>` : g.status === 'paused' ? 'Paused' : `Ends <t:${Math.floor(new Date(g.endsAt).getTime() / 1000)}:R>`;
      const link = jumpLink(g);
      return `**#${g.giveawayId}** • ${truncate(g.prize, 40)} • ${when} • ${g.entrants.length} entries${link ? ` • [Jump](${link})` : ''}`;
    });
    return ctx.reply({
      embeds: [new EmbedBuilder().setColor(config.colors.brand).setTitle(`Giveaways (${status})`).setDescription(truncate(lines.join('\n'), 4000)).setFooter({ text: 'Showing the 15 newest.' })],
    });
  },
};
