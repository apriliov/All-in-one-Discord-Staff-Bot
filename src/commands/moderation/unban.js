const embeds = require('../../utils/embeds');
const { createCase } = require('../../services/cases');
const { auditReason, DEFAULT_REASON } = require('../../services/moderation');

module.exports = {
  name: 'unban',
  description: 'Remove a ban from a user.',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'user', type: 'user', description: 'User ID or mention to unban', required: true },
    { name: 'reason', type: 'string', description: 'Reason', maxLength: 500 },
  ],
  async run(ctx, args) {
    const reason = args.reason || DEFAULT_REASON;
    try {
      await ctx.guild.bans.remove(args.user.id, auditReason(ctx, reason));
    } catch (err) {
      if (err.code === 10026) return ctx.reply({ embeds: [embeds.error('That user is not banned.')] });
      throw err;
    }
    const doc = await createCase(ctx, { type: 'unban', user: args.user, reason });
    return ctx.reply({ embeds: [embeds.success(`Unbanned <@${args.user.id}> (case **#${doc.caseId}**).`)] });
  },
};
