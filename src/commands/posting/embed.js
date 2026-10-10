const {
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { logEvent } = require('../../services/cases');
const { truncate } = require('../../utils/format');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread];

const row = (id, label, style, { required = false, max = 100, placeholder } = {}) =>
  new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setRequired(required)
      .setMaxLength(max)
      .setPlaceholder(placeholder || '')
  );

module.exports = {
  name: 'embed',
  description: 'Post an embed. Slash without content opens a form. Prefix: Title | Description',
  category: 'Posting',
  level: 'helper',
  noDefer: true,
  options: [
    { name: 'channel', type: 'channel', description: 'Channel to post in', required: true, channelTypes: TEXT_TYPES },
    { name: 'content', type: 'string', description: 'Title | Description (leave empty in slash to open a form)', maxLength: 4000 },
  ],
  async run(ctx, args) {
    const problem = canPostIn(ctx, args.channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });

    if (ctx.isSlash && !args.content) {
      const modalId = `embed-${ctx.interaction.id}`;
      const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle('Post an embed')
        .addComponents(
          row('title', 'Title (optional)', TextInputStyle.Short, { max: 256 }),
          row('description', 'Description', TextInputStyle.Paragraph, { required: true, max: 4000 }),
          row('color', 'Color (hex, optional)', TextInputStyle.Short, { max: 7, placeholder: '#5865F2' }),
          row('image', 'Image URL (optional)', TextInputStyle.Short, { max: 500, placeholder: 'https://...' }),
          row('footer', 'Footer (optional)', TextInputStyle.Short, { max: 200 })
        );
      await ctx.interaction.showModal(modal);

      const submit = await ctx.interaction
        .awaitModalSubmit({ time: 5 * 60 * 1000, filter: (i) => i.customId === modalId && i.user.id === ctx.user.id })
        .catch(() => null);
      if (!submit) return;

      const embed = embeds.customEmbed({
        title: submit.fields.getTextInputValue('title'),
        description: submit.fields.getTextInputValue('description'),
        color: submit.fields.getTextInputValue('color'),
        image: submit.fields.getTextInputValue('image'),
        footer: submit.fields.getTextInputValue('footer'),
      });
      const sent = await args.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await logEvent(ctx, 'Embed posted', `Posted in <#${args.channel.id}>: [jump to message](${sent.url})`);
      return submit.reply({
        embeds: [embeds.success(`Embed posted in <#${args.channel.id}>. [Jump to message](${sent.url})`)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!args.content) {
      return ctx.reply({ embeds: [embeds.error('Write the embed as `Title | Description`, or just a description.')] });
    }
    const text = args.content.replace(/\\n/g, '\n');
    const [first, ...others] = text.split('|');
    const hasTitle = others.length > 0;
    const title = hasTitle ? first.trim() : null;
    const description = (hasTitle ? others.join('|') : first).trim();
    if (!description) return ctx.reply({ embeds: [embeds.error('The embed description cannot be empty.')] });
    if (title && title.length > 256) return ctx.reply({ embeds: [embeds.error('The title is too long (max 256 characters).')] });

    const sent = await args.channel.send({ embeds: [embeds.customEmbed({ title, description })], allowedMentions: { parse: [] } });
    if (ctx.message) await ctx.message.delete().catch(() => {});
    await logEvent(ctx, 'Embed posted', `Posted in <#${args.channel.id}>: [jump to message](${sent.url})\n${truncate(description, 500)}`);

    const done = embeds.success(`Embed posted in <#${args.channel.id}>. [Jump to message](${sent.url})`);
    if (ctx.message) {
      const note = await ctx.send({ embeds: [done] });
      setTimeout(() => note.delete().catch(() => {}), 6000);
      return;
    }
    return ctx.reply({ embeds: [done] });
  },
};
