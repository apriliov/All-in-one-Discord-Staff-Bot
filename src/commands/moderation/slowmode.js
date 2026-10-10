const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { auditReason } = require('../../services/moderation');

module.exports = {
  name: 'slowmode',
  aliases: ['sm'],
  description: 'Set the slowmode of this channel (0 turns it off).',
  category: 'Moderation',
  level: 'helper',
  options: [{ name: 'seconds', type: 'integer', description: 'Seconds between messages (0-21600)', required: true, min: 0, max: 21600 }],
  async run(ctx, args) {
    const channel = ctx.channel;
    if (typeof channel.setRateLimitPerUser !== 'function') {
      return ctx.reply({ embeds: [embeds.error('Slowmode cannot be set in this channel.')] });
    }
    await channel.setRateLimitPerUser(args.seconds, auditReason(ctx, 'Slowmode changed'));
    await logEvent(ctx, 'Slowmode changed', `<#${channel.id}> slowmode is now **${args.seconds}s**.`);
    return ctx.reply({
      embeds: [embeds.success(args.seconds === 0 ? 'Slowmode turned off.' : `Slowmode set to **${args.seconds}s**.`)],
    });
  },
};
