const { EmbedBuilder } = require('discord.js');
const Case = require('../../database/models/Case');
const { colors } = require('../../config');
const { ts } = require('../../utils/format');
const { getLevel, LEVEL_NAMES } = require('../../core/permissions');

module.exports = {
  name: 'userinfo',
  aliases: ['ui', 'whois'],
  description: 'Show information and staff history for a user.',
  category: 'Utility',
  level: 'helper',
  options: [{ name: 'user', type: 'user', description: 'User to look up (default: you)' }],
  async run(ctx, args) {
    const user = args.user || ctx.user;
    const member = await ctx.guild.members.fetch(user.id).catch(() => null);
    const filter = { guildId: ctx.guild.id, userId: user.id };
    const [warns, notes, total] = await Promise.all([
      Case.countDocuments({ ...filter, type: 'warn' }),
      Case.countDocuments({ ...filter, type: 'note' }),
      Case.countDocuments(filter),
    ]);

    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'User', value: `<@${user.id}>\n\`${user.id}\``, inline: true },
        { name: 'Account created', value: ts(user.createdAt), inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true }
      );

    if (member) {
      const roles = [...member.roles.cache.filter((r) => r.id !== ctx.guild.id).sort((a, b) => b.position - a.position).values()];
      embed.addFields(
        { name: 'Joined server', value: member.joinedAt ? ts(member.joinedAt) : 'Unknown', inline: true },
        { name: 'Staff level', value: LEVEL_NAMES[getLevel(member, ctx.config)], inline: true },
        {
          name: 'Timed out',
          value: member.communicationDisabledUntil ? `Until ${ts(member.communicationDisabledUntil, 'f')}` : 'No',
          inline: true,
        },
        { name: `Roles (${roles.length})`, value: roles.slice(0, 15).map(String).join(' ') || 'None' }
      );
    } else {
      embed.addFields({ name: 'In server', value: 'No' });
    }
    embed.addFields({ name: 'Staff history', value: `${warns} warning(s) • ${notes} note(s) • ${total} case(s) total` });
    return ctx.reply({ embeds: [embed] });
  },
};
