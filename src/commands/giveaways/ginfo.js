const { EmbedBuilder } = require('discord.js');
const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const config = require('../../config');
const { jumpLink } = require('../../services/giveaways');
const { truncate } = require('../../utils/format');
const { formatDuration } = require('../../utils/duration');

const ts = (d, style = 'R') => `<t:${Math.floor(new Date(d).getTime() / 1000)}:${style}>`;

module.exports = {
  name: 'ginfo',
  description: 'Show the details of one giveaway.',
  category: 'Giveaways',
  level: 'helper',
  options: [{ name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 }],
  async run(ctx, args) {
    const g = await Giveaway.findOne({ guildId: ctx.guild.id, giveawayId: args.id }).lean();
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });

    const embed = new EmbedBuilder()
      .setColor(config.colors.brand)
      .setTitle(`Giveaway #${g.giveawayId}`)
      .setDescription(`**Prize:** ${truncate(g.prize, 300)}${g.description ? `\n${truncate(g.description, 500)}` : ''}`)
      .addFields(
        { name: 'Status', value: g.status, inline: true },
        { name: 'Channel', value: `<#${g.channelId}>`, inline: true },
        { name: 'Host', value: `<@${g.hostId}>`, inline: true },
        { name: g.status === 'ended' ? 'Ended' : g.status === 'paused' ? 'Time left' : 'Ends', value: g.status === 'ended' ? ts(g.endedAt || g.endsAt) : g.status === 'paused' ? formatDuration(g.remainingMs || 0) : ts(g.endsAt), inline: true },
        { name: 'Winners', value: String(g.winnerCount), inline: true },
        { name: 'Entries', value: String(g.entrants.length), inline: true },
        { name: 'Required role', value: g.requiredRoleId ? `<@&${g.requiredRoleId}>` : 'None', inline: true },
        { name: 'Bonus entries', value: g.bonusRoleId && g.bonusEntries > 1 ? `<@&${g.bonusRoleId}> (${g.bonusEntries}x)` : 'None', inline: true }
      );
    if (g.winners.length) embed.addFields({ name: 'Winners picked', value: truncate(g.winners.map((id) => `<@${id}>`).join(', '), 1000) });
    const link = jumpLink(g);
    if (link) embed.addFields({ name: 'Message', value: `[Jump to giveaway](${link})` });
    return ctx.reply({ embeds: [embed] });
  },
};
