const embeds = require('../../utils/embeds');
const { createCase, notifyUser } = require('../../services/cases');
const { checkTarget, auditReason, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'ban',
  description: 'Ban a user from the server (works on users who already left).',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'user', type: 'user', description: 'User to ban', required: true },
    { name: 'reason', type: 'string', description: 'Reason for the ban', maxLength: 500 },
  ],
  async run(ctx, args) {
    const { error, member } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });
    if (member && !member.bannable) return ctx.reply({ embeds: [embeds.error('I cannot ban that member (my role is too low).')] });

    const reason = args.reason || DEFAULT_REASON;
    const dmOk = member ? await notifyUser(args.user, ctx.guild, 'You have been banned', reason) : false;
    await ctx.guild.members.ban(args.user.id, { reason: auditReason(ctx, reason) });
    const doc = await createCase(ctx, { type: 'ban', user: args.user, reason });
    return ctx.reply({
      embeds: [embeds.success(`Banned <@${args.user.id}> (case **#${doc.caseId}**).${member && !dmOk ? ' I could not DM them.' : ''}`)],
    });
  },
};
