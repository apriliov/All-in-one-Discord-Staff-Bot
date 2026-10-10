const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config');
const { ts } = require('../../utils/format');

module.exports = {
  name: 'serverinfo',
  aliases: ['si'],
  description: 'Show information about this server.',
  category: 'Utility',
  level: 'helper',
  async run(ctx) {
    const g = ctx.guild;
    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setTitle(g.name)
      .setThumbnail(g.iconURL({ size: 256 }))
      .addFields(
        { name: 'Server ID', value: `\`${g.id}\``, inline: true },
        { name: 'Owner', value: `<@${g.ownerId}>`, inline: true },
        { name: 'Created', value: ts(g.createdAt), inline: true },
        { name: 'Members', value: String(g.memberCount), inline: true },
        { name: 'Channels', value: String(g.channels.cache.size), inline: true },
        { name: 'Roles', value: String(g.roles.cache.size), inline: true },
        { name: 'Boosts', value: `${g.premiumSubscriptionCount || 0} (tier ${g.premiumTier})`, inline: true }
      );
    return ctx.reply({ embeds: [embed] });
  },
};
