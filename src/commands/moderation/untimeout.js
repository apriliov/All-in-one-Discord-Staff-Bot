const embeds = require('../../utils/embeds');
const { createCase } = require('../../services/cases');
const { checkTarget, auditReason, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'untimeout',
  aliases: ['unmute'],
  description: 'Remove a timeout from a member.',
  category: 'Moderation',
  level: 'helper',
  options: [
    { name: 'user', type: 'user', description: 'Member to release', required: true },
    { name: 'reason', type: 'string', description: 'Reason', maxLength: 500 },
  ],
  async run(ctx, args) {
    const { error, member } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });
    if (!member.isCommunicationDisabled()) return ctx.reply({ embeds: [embeds.error('That member is not timed out.')] });

    const reason = args.reason || DEFAULT_REASON;
    await member.timeout(null, auditReason(ctx, reason));
    const doc = await createCase(ctx, { type: 'untimeout', user: args.user, reason });
    return ctx.reply({ embeds: [embeds.success(`Removed the timeout from <@${args.user.id}> (case **#${doc.caseId}**).`)] });
  },
};
