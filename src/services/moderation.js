const { getLevel, LEVELS } = require('../core/permissions');

const DEFAULT_REASON = 'No reason provided';

async function checkTarget(ctx, user) {
  if (user.id === ctx.user.id) return { error: 'You cannot do that to yourself.' };
  if (user.id === ctx.client.user.id) return { error: 'I cannot do that to myself.' };
  if (user.id === ctx.guild.ownerId) return { error: 'You cannot moderate the server owner.' };

  const member = await ctx.guild.members.fetch(user.id).catch(() => null);
  if (member && ctx.level < LEVELS.owner) {
    if (getLevel(member, ctx.config) >= ctx.level) {
      return { error: 'You cannot moderate someone with an equal or higher staff level.' };
    }
    if (ctx.guild.ownerId !== ctx.user.id && ctx.member.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
      return { error: 'That member has a role equal to or higher than your highest role.' };
    }
  }
  return { error: null, member };
}

const auditReason = (ctx, reason) => `${reason} | by ${ctx.user.username} (${ctx.user.id})`.slice(0, 512);

module.exports = { checkTarget, auditReason, DEFAULT_REASON };
