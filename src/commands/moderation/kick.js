const embeds = require('../../utils/embeds');
const { createCase, notifyUser } = require('../../services/cases');
const { checkTarget, auditReason, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'kick',
  description: 'Kick a member from the server.',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'user', type: 'user', description: 'Member to kick', required: true },
    { name: 'reason', type: 'string', description: 'Reason for the kick', maxLength: 500 },
  ],
  async run(ctx, args) {
    const { error, member } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });
    if (!member.kickable) return ctx.reply({ embeds: [embeds.error('I cannot kick that member (my role is too low).')] });

    const reason = args.reason || DEFAULT_REASON;
    const dmOk = await notifyUser(args.user, ctx.guild, 'You have been kicked', reason);
    await member.kick(auditReason(ctx, reason));
    const doc = await createCase(ctx, { type: 'kick', user: args.user, reason });
    return ctx.reply({
      embeds: [embeds.success(`Kicked <@${args.user.id}> (case **#${doc.caseId}**).${dmOk ? '' : ' I could not DM them.'}`)],
    });
  },
};
