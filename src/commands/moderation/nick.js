const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { checkTarget, auditReason } = require('../../services/moderation');

module.exports = {
  name: 'nick',
  aliases: ['nickname'],
  description: 'Change or reset the nickname of a member.',
  category: 'Moderation',
  level: 'helper',
  options: [
    { name: 'user', type: 'user', description: 'Member to rename', required: true },
    { name: 'nickname', type: 'string', description: 'New nickname (leave empty to reset)', maxLength: 32 },
  ],
  async run(ctx, args) {
    let member = ctx.member;
    if (args.user.id !== ctx.user.id) {
      const target = await checkTarget(ctx, args.user);
      if (target.error) return ctx.reply({ embeds: [embeds.error(target.error)] });
      member = target.member;
    }
    if (!member) return ctx.reply({ embeds: [embeds.error('That user is not in this server.')] });
    if (!member.manageable) return ctx.reply({ embeds: [embeds.error('I cannot change that nickname (my role is too low).')] });

    const before = member.displayName;
    await member.setNickname(args.nickname || null, auditReason(ctx, 'Nickname changed'));
    await logEvent(ctx, 'Nickname changed', `<@${member.id}>: **${before}** to **${args.nickname || 'reset'}**`);
    return ctx.reply({ embeds: [embeds.success(args.nickname ? `Nickname of <@${member.id}> is now **${args.nickname}**.` : `Nickname of <@${member.id}> was reset.`)] });
  },
};
