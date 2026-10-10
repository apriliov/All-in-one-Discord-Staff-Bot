const embeds = require('../../utils/embeds');
const { createCase, notifyUser } = require('../../services/cases');
const { checkTarget, auditReason, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'softban',
  description: 'Ban and instantly unban a member to delete their last 7 days of messages.',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'user', type: 'user', description: 'Member to softban', required: true },
    { name: 'reason', type: 'string', description: 'Reason for the softban', maxLength: 500 },
  ],
  async run(ctx, args) {
    const { error, member } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });
    if (!member.bannable) return ctx.reply({ embeds: [embeds.error('I cannot softban that member (my role is too low).')] });

    const reason = args.reason || DEFAULT_REASON;
    const dmOk = await notifyUser(args.user, ctx.guild, 'You have been softbanned', reason, 'You can join the server again.');
    await ctx.guild.members.ban(args.user.id, { deleteMessageSeconds: 7 * 24 * 60 * 60, reason: auditReason(ctx, `Softban: ${reason}`) });
    await ctx.guild.bans.remove(args.user.id, auditReason(ctx, 'Softban finished'));
    const doc = await createCase(ctx, { type: 'softban', user: args.user, reason });
    return ctx.reply({ embeds: [embeds.success(`Softbanned <@${args.user.id}> (case **#${doc.caseId}**).${dmOk ? '' : ' I could not DM them.'}`)] });
  },
};
