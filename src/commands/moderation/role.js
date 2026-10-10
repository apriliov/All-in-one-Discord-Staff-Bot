const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { auditReason } = require('../../services/moderation');
const { LEVELS } = require('../../core/permissions');

module.exports = {
  name: 'role',
  description: 'Add a role to a member, or remove it if they already have it.',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'user', type: 'user', description: 'Member to update', required: true },
    { name: 'role', type: 'role', description: 'Role to toggle', required: true },
  ],
  async run(ctx, args) {
    const role = args.role;
    if (role.id === ctx.guild.id || role.managed) return ctx.reply({ embeds: [embeds.error('That role cannot be given or removed manually.')] });
    if (role.position >= ctx.guild.members.me.roles.highest.position) {
      return ctx.reply({ embeds: [embeds.error('That role is higher than or equal to my highest role.')] });
    }
    if (ctx.level < LEVELS.owner && ctx.guild.ownerId !== ctx.user.id && role.position >= ctx.member.roles.highest.position) {
      return ctx.reply({ embeds: [embeds.error('That role is higher than or equal to your highest role.')] });
    }

    const member = await ctx.guild.members.fetch(args.user.id).catch(() => null);
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });

    const has = member.roles.cache.has(role.id);
    if (has) await member.roles.remove(role.id, auditReason(ctx, 'Role removed'));
    else await member.roles.add(role.id, auditReason(ctx, 'Role added'));
    await logEvent(ctx, has ? 'Role removed' : 'Role added', `<@&${role.id}> ${has ? 'removed from' : 'added to'} <@${member.id}>.`);
    return ctx.reply({ embeds: [embeds.success(has ? `Removed <@&${role.id}> from <@${member.id}>.` : `Added <@&${role.id}> to <@${member.id}>.`)] });
  },
};
