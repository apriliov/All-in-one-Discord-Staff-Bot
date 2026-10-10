const { ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { logEvent } = require('../../services/cases');
const { createStatusPage } = require('../../services/statusPage');

module.exports = {
  name: 'status',
  description: 'Post a live status page (user + bot online/idle/offline and activity) in a channel.',
  category: 'Utility',
  level: 'admin',
  options: [
    {
      name: 'channel',
      type: 'channel',
      required: true,
      description: 'Channel where the live status embed is posted',
      channelTypes: [ChannelType.GuildText, ChannelType.GuildAnnouncement],
    },
  ],
  async run(ctx, args) {
    const channel = args.channel;
    const problem = canPostIn(ctx, channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    const message = await createStatusPage(ctx.client, ctx.guild, channel);
    await logEvent(ctx, 'Status page created', `Live status page posted in <#${channel.id}>.`);
    return ctx.reply({ embeds: [embeds.success(`Live status page posted in <#${channel.id}>: ${message.url}\nIt updates by itself, no need to run the command again.`)] });
  },
};
