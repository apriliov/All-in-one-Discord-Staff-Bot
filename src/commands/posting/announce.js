const { ChannelType, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn, LEVELS } = require('../../core/permissions');
const { logEvent } = require('../../services/cases');
const { truncate } = require('../../utils/format');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];

module.exports = {
  name: 'announce',
  description: 'Post an announcement that is allowed to ping roles (and @everyone if you can).',
  category: 'Posting',
  level: 'admin',
  ephemeral: true,
  options: [
    { name: 'channel', type: 'channel', description: 'Channel to announce in', required: true, channelTypes: TEXT_TYPES },
    { name: 'message', type: 'string', description: 'Announcement text (use \\n for a new line)', required: true, maxLength: 2000 },
  ],
  async run(ctx, args) {
    const problem = canPostIn(ctx, args.channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    const text = args.message.replace(/\\n/g, '\n');
    const everyoneAllowed = ctx.level >= LEVELS.owner || ctx.member.permissions.has(PermissionFlagsBits.MentionEveryone);
    const sent = await args.channel.send({
      content: text,
      allowedMentions: { parse: everyoneAllowed ? ['roles', 'users', 'everyone'] : ['roles', 'users'] },
    });

    if (ctx.message) await ctx.message.delete().catch(() => {});
    await logEvent(ctx, 'Announcement posted', `Posted in <#${args.channel.id}>: [jump to message](${sent.url})\n${truncate(text, 500)}`);

    const done = embeds.success(`Announcement posted in <#${args.channel.id}>. [Jump to message](${sent.url})`);
    if (ctx.message) {
      const note = await ctx.send({ embeds: [done] });
      setTimeout(() => note.delete().catch(() => {}), 6000);
      return;
    }
    return ctx.reply({ embeds: [done] });
  },
};
