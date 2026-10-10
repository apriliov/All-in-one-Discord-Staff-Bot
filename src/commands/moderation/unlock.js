const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { unlockChannel } = require('../../services/lock');

module.exports = {
  name: 'unlock',
  description: 'Let members send messages in a channel again.',
  category: 'Moderation',
  level: 'admin',
  options: [{ name: 'channel', type: 'channel', description: 'Channel to unlock (default: this one)' }],
  async run(ctx, args) {
    const channel = args.channel || ctx.channel;
    const res = await unlockChannel(ctx, channel);
    if (res.error) return ctx.reply({ embeds: [embeds.error(res.error)] });
    if (res.failed) {
      return ctx.reply({ embeds: [embeds.error(`I could not restore ${res.failed} permission overwrite(s). Check my **Manage Roles** permission and run \`unlock\` again.`)] });
    }
    await logEvent(ctx, 'Channel unlocked', `<#${channel.id}> was unlocked.`);
    return ctx.reply({ embeds: [embeds.success(`🔓 Unlocked <#${channel.id}>.`)] });
  },
};
