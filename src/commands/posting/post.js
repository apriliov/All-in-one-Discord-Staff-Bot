const { ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { logEvent } = require('../../services/cases');
const { truncate } = require('../../utils/format');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread];

module.exports = {
  name: 'post',
  aliases: ['say'],
  description: 'Send a message to a channel as the bot (no pings). Use \\n for a new line.',
  category: 'Posting',
  level: 'helper',
  ephemeral: true,
  options: [
    { name: 'channel', type: 'channel', description: 'Channel to post in', required: true, channelTypes: TEXT_TYPES },
    { name: 'attachment', type: 'attachment', description: 'Optional file to attach' },
    { name: 'message', type: 'string', description: 'Message text (use \\n for a new line)', maxLength: 2000 },
  ],
  async run(ctx, args) {
    if (!args.message && !args.attachment) {
      return ctx.reply({ embeds: [embeds.error('Write a message or attach a file.')] });
    }
    const problem = canPostIn(ctx, args.channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    const text = args.message ? args.message.replace(/\\n/g, '\n') : undefined;
    const sent = await args.channel.send({
      content: text,
      files: args.attachment ? [args.attachment.url] : undefined,
      allowedMentions: { parse: [] },
    });

    if (ctx.message) await ctx.message.delete().catch(() => {});
    await logEvent(ctx, 'Message posted', `Posted in <#${args.channel.id}>: [jump to message](${sent.url})\n${truncate(text || '(attachment only)', 500)}`);

    const done = embeds.success(`Posted in <#${args.channel.id}>. [Jump to message](${sent.url})`);
    if (ctx.message) {
      const note = await ctx.send({ embeds: [done] });
      setTimeout(() => note.delete().catch(() => {}), 6000);
      return;
    }
    return ctx.reply({ embeds: [done] });
  },
};
