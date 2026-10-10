const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { logEvent } = require('../../services/cases');
const { EmbedBuilder } = require('discord.js');

const LINK = /^https?:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\/?$/i;

module.exports = {
  name: 'editpost',
  description: 'Edit a message that this bot posted (text or embed description).',
  category: 'Posting',
  level: 'helper',
  ephemeral: true,
  options: [
    { name: 'link', type: 'string', description: 'Message link of the bot message', required: true, maxLength: 200 },
    { name: 'text', type: 'string', description: 'New text (use \\n for a new line)', required: true, maxLength: 4000 },
  ],
  async run(ctx, args) {
    const match = args.link.trim().match(LINK);
    if (!match || match[1] !== ctx.guild.id) {
      return ctx.reply({ embeds: [embeds.error('Give me a valid message link from this server.')] });
    }
    const channel = await ctx.guild.channels.fetch(match[2]).catch(() => null);
    const problem = canPostIn(ctx, channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    const message = await channel.messages.fetch(match[3]).catch(() => null);
    if (!message) return ctx.reply({ embeds: [embeds.error('I could not find that message.')] });
    if (message.author.id !== ctx.client.user.id) {
      return ctx.reply({ embeds: [embeds.error('I can only edit messages that I posted myself.')] });
    }

    const text = args.text.replace(/\\n/g, '\n');
    if (message.embeds.length > 0) {
      if (text.length > 4000) return ctx.reply({ embeds: [embeds.error('Embed descriptions are limited to 4000 characters.')] });
      await message.edit({ embeds: [EmbedBuilder.from(message.embeds[0]).setDescription(text)], allowedMentions: { parse: [] } });
    } else {
      if (text.length > 2000) return ctx.reply({ embeds: [embeds.error('Messages are limited to 2000 characters.')] });
      await message.edit({ content: text, allowedMentions: { parse: [] } });
    }

    if (ctx.message) await ctx.message.delete().catch(() => {});
    await logEvent(ctx, 'Bot message edited', `Edited a bot message in <#${channel.id}>: [jump to message](${message.url})`);
    const done = embeds.success(`Message edited. [Jump to message](${message.url})`);
    if (ctx.message) {
      const note = await ctx.send({ embeds: [done] });
      setTimeout(() => note.delete().catch(() => {}), 6000);
      return;
    }
    return ctx.reply({ embeds: [done] });
  },
};
