const embeds = require('../../utils/embeds');
const { createCase, notifyUser } = require('../../services/cases');
const { checkTarget, auditReason, DEFAULT_REASON } = require('../../services/moderation');
const { parseDuration, formatDuration, DAY, MAX_TIMEOUT } = require('../../utils/duration');
const { LEVELS } = require('../../core/permissions');

module.exports = {
  name: 'timeout',
  aliases: ['mute', 'to'],
  description: 'Time a member out (helpers: up to 1 day, admins: up to 28 days).',
  category: 'Moderation',
  level: 'helper',
  options: [
    { name: 'user', type: 'user', description: 'Member to time out', required: true },
    { name: 'duration', type: 'string', description: 'Examples: 10m, 2h, 1d, 1h30m', required: true, maxLength: 20 },
    { name: 'reason', type: 'string', description: 'Reason for the timeout', maxLength: 500 },
  ],
  async run(ctx, args) {
    const ms = parseDuration(args.duration);
    if (!ms) return ctx.reply({ embeds: [embeds.error('Invalid duration. Examples: `10m`, `2h`, `1d`, `1h30m`.')] });

    const max = ctx.level >= LEVELS.admin ? MAX_TIMEOUT : DAY;
    if (ms > max) {
      return ctx.reply({ embeds: [embeds.error(`The maximum timeout for your level is **${formatDuration(max)}**.`)] });
    }

    const { error, member } = await checkTarget(ctx, args.user);
    if (error) return ctx.reply({ embeds: [embeds.error(error)] });
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });
    if (!member.moderatable) return ctx.reply({ embeds: [embeds.error('I cannot time out that member (my role is too low).')] });

    const reason = args.reason || DEFAULT_REASON;
    await member.timeout(ms, auditReason(ctx, reason));
    const doc = await createCase(ctx, { type: 'timeout', user: args.user, reason, duration: ms });
    const dmOk = await notifyUser(args.user, ctx.guild, 'You have been timed out', reason, `**Duration:** ${formatDuration(ms)}`);
    return ctx.reply({
      embeds: [
        embeds.success(
          `Timed out <@${args.user.id}> for **${formatDuration(ms)}** (case **#${doc.caseId}**).${dmOk ? '' : ' I could not DM them.'}`
        ),
      ],
    });
  },
};
