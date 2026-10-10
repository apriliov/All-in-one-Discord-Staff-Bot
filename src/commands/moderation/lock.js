const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { lockChannel } = require('../../services/lock');

module.exports = {
  name: 'lock',
  description: 'Stop members from sending messages in a channel (staff and the bot can still talk).',
  category: 'Moderation',
  level: 'admin',
  options: [{ name: 'channel', type: 'channel', description: 'Channel to lock (default: this one)' }],
  async run(ctx, args) {
    const channel = args.channel || ctx.channel;
    const res = await lockChannel(ctx, channel);
    if (res.error) return ctx.reply({ embeds: [embeds.error(res.error)] });
    await logEvent(ctx, 'Channel locked', `<#${channel.id}> was locked.`);
    return ctx.reply({ embeds: [embeds.success(`🔒 Locked <#${channel.id}>.`)] });
  },
};
