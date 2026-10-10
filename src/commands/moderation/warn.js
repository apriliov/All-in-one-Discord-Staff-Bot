const embeds = require('../../utils/embeds');
const { createCase, notifyUser } = require('../../services/cases');
const { checkTarget, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'warn',
  aliases: ['w'],
  description: 'Warn a member and record it in the case log.',
  category: 'Moderation',
  level: 'helper',
  options: [
    { name: 'user', type: 'user', description: 'Member to warn', required: true },
    { name: 'reason', type: 'string', description: 'Reason for the warning', maxLength: 500 },
  ],
  async run(ctx, args) {
    const { error } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });

    const reason = args.reason || DEFAULT_REASON;
    const doc = await createCase(ctx, { type: 'warn', user: args.user, reason });
    const dmOk = await notifyUser(args.user, ctx.guild, 'You have received a warning', reason);
    return ctx.reply({
      embeds: [embeds.success(`Warned <@${args.user.id}> (case **#${doc.caseId}**).${dmOk ? '' : ' I could not DM them.'}`)],
    });
  },
};
