const {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../../config');
const GuildConfig = require('../../database/models/GuildConfig');
const embeds = require('../../utils/embeds');
const { truncate } = require('../../utils/format');
const { logEvent } = require('../../services/cases');
const { getGuildConfig } = require('../../services/guildConfig');
const { welcomeEmbed, getWelcome, closeText, DEFAULT_CLOSE } = require('../../services/modmail');
const { refreshPresence } = require('../../services/status');
const { scheduleRefresh } = require('../../services/statusPage');

const input = (id, label, style, { value, required = false, max = 100, placeholder } = {}) => {
  const field = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  if (value) field.setValue(String(value).slice(0, max));
  if (placeholder) field.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(field);
};

const unescapeNewlines = (text) => String(text).replace(/\\n/g, '\n');
const isReset = (text) => String(text || '').trim().toLowerCase() === 'reset';

async function askModal(ctx, modal) {
  await ctx.interaction.showModal(modal);
  return ctx.interaction
    .awaitModalSubmit({ time: 10 * 60 * 1000, filter: (i) => i.customId === modal.data.custom_id && i.user.id === ctx.user.id })
    .catch(() => null);
}

async function setSwitch(ctx, open) {
  await GuildConfig.updateOne({ guildId: ctx.guild.id }, { modmailOpen: open }, { upsert: true });
  const status = await refreshPresence(ctx.client);
  scheduleRefresh(ctx.client);
  await logEvent(
    ctx,
    open ? 'Modmail opened' : 'Modmail closed',
    open ? 'New tickets can be opened again.' : 'No new tickets will be opened. Existing tickets keep working.'
  );
  return ctx.reply({
    embeds: [
      embeds.success(
        open
          ? `Modmail is now **open**. Bot status: \`${status}\``
          : `Modmail is now **closed**. DMs will not open a new channel. Existing tickets keep working.\nBot status: \`${status}\``
      ),
    ],
  });
}

async function saveWelcome(ctx, data) {
  await GuildConfig.updateOne({ guildId: ctx.guild.id }, { modmailWelcome: data }, { upsert: true });
  await logEvent(ctx, data ? 'Modmail welcome message edited' : 'Modmail welcome message reset', data ? 'A custom welcome message is now used.' : 'The default welcome message is used again.');
}

async function saveClose(ctx, text) {
  await GuildConfig.updateOne({ guildId: ctx.guild.id }, { modmailCloseMsg: text }, { upsert: true });
  await logEvent(ctx, text ? 'Modmail close message edited' : 'Modmail close message reset', text ? 'A custom close message is now used.' : 'The default close message is used again.');
}

async function welcomeAction(ctx, args) {
  const cfg = await getGuildConfig(ctx.guild.id);
  const w = getWelcome(cfg);

  if (args.text && isReset(args.text)) {
    await saveWelcome(ctx, null);
    return ctx.reply({ embeds: [embeds.success('The welcome message was reset to the default.')] });
  }

  if (args.text) {
    const raw = unescapeNewlines(args.text);
    const sep = raw.indexOf('|');
    const title = sep === -1 ? w.title : raw.slice(0, sep).trim();
    const description = (sep === -1 ? raw : raw.slice(sep + 1)).trim();
    if (!description) return ctx.reply({ embeds: [embeds.error('The description cannot be empty. Use: Title | Description')] });
    const data = { title: truncate(title, 256) || w.title, description: truncate(description, 3000), footer: w.footer, color: w.color };
    await saveWelcome(ctx, data);
    const preview = welcomeEmbed(ctx.guild, ctx.user, { modmailWelcome: data });
    return ctx.reply({ embeds: [embeds.success('Welcome message updated. Preview:'), preview] });
  }

  if (ctx.isSlash) {
    const modal = new ModalBuilder()
      .setCustomId(`mmwelcome-${ctx.interaction.id}`)
      .setTitle('Edit modmail welcome message')
      .addComponents(
        input('title', 'Title', TextInputStyle.Short, { value: w.title, required: true, max: 256 }),
        input('description', 'Description', TextInputStyle.Paragraph, { value: w.description, required: true, max: 3000, placeholder: 'Variables: {server} {user} {username}' }),
        input('footer', 'Footer (empty = none)', TextInputStyle.Short, { value: w.footer, max: 200 }),
        input('color', 'Color (hex, optional)', TextInputStyle.Short, { value: w.color, max: 7, placeholder: '#5865F2' })
      );
    const submit = await askModal(ctx, modal);
    if (!submit) return;
    const data = {
      title: submit.fields.getTextInputValue('title').trim(),
      description: submit.fields.getTextInputValue('description').trim(),
      footer: submit.fields.getTextInputValue('footer').trim(),
      color: submit.fields.getTextInputValue('color').trim(),
    };
    if (isReset(data.description)) {
      await saveWelcome(ctx, null);
      return submit.reply({ embeds: [embeds.success('The welcome message was reset to the default.')], flags: MessageFlags.Ephemeral });
    }
    await saveWelcome(ctx, data);
    const preview = welcomeEmbed(ctx.guild, ctx.user, { modmailWelcome: data });
    return submit.reply({ embeds: [embeds.success('Welcome message updated. Preview:'), preview], flags: MessageFlags.Ephemeral });
  }

  return ctx.reply({
    embeds: [
      embeds.info('Current welcome message:'),
      welcomeEmbed(ctx.guild, ctx.user, cfg),
      embeds.info('Edit: `{prefix}modmail welcome Title | Description` (use `\\n` for a new line)\nReset: `{prefix}modmail welcome reset`\nVariables: `{server}` `{user}` `{username}`'),
    ],
  });
}

async function closeAction(ctx, args) {
  const cfg = await getGuildConfig(ctx.guild.id);
  const current = cfg.modmailCloseMsg || DEFAULT_CLOSE;
  const preview = (data) =>
    new EmbedBuilder()
      .setColor(config.colors.white)
      .setAuthor({ name: 'Staff' })
      .setDescription(closeText({ modmailCloseMsg: data }, { guild: ctx.guild, user: ctx.user, reason: 'Issue solved' }));

  if (args.text && isReset(args.text)) {
    await saveClose(ctx, null);
    return ctx.reply({ embeds: [embeds.success('The close message was reset to the default.')] });
  }

  if (args.text) {
    const text = truncate(unescapeNewlines(args.text).trim(), 3000);
    await saveClose(ctx, text);
    return ctx.reply({ embeds: [embeds.success('Close message updated. Preview:'), preview(text)] });
  }

  if (ctx.isSlash) {
    const modal = new ModalBuilder()
      .setCustomId(`mmclose-${ctx.interaction.id}`)
      .setTitle('Edit modmail close message')
      .addComponents(input('text', 'Message sent when a ticket closes', TextInputStyle.Paragraph, { value: current, required: true, max: 3000, placeholder: 'Variables: {server} {user} {username} {reason}' }));
    const submit = await askModal(ctx, modal);
    if (!submit) return;
    const text = submit.fields.getTextInputValue('text').trim();
    if (isReset(text)) {
      await saveClose(ctx, null);
      return submit.reply({ embeds: [embeds.success('The close message was reset to the default.')], flags: MessageFlags.Ephemeral });
    }
    await saveClose(ctx, text);
    return submit.reply({ embeds: [embeds.success('Close message updated. Preview:'), preview(text)], flags: MessageFlags.Ephemeral });
  }

  return ctx.reply({
    embeds: [
      embeds.info('Current close message:'),
      preview(cfg.modmailCloseMsg),
      embeds.info('Edit: `{prefix}modmail closemsg <message>` (use `\\n` for a new line)\nReset: `{prefix}modmail closemsg reset`\nVariables: `{server}` `{user}` `{username}` `{reason}`'),
    ],
  });
}

module.exports = {
  name: 'modmail',
  description: 'Open or close modmail, or edit its welcome and close messages.',
  category: 'Modmail',
  level: 'admin',
  ephemeral: true,
  noDefer: true,
  options: [
    { name: 'action', type: 'string', description: 'open, close, welcome or closemsg', choices: ['open', 'close', 'welcome', 'closemsg'] },
    { name: 'text', type: 'string', description: 'welcome: Title | Description. closemsg: the message. Use "reset" for default.', maxLength: 3000 },
  ],
  async run(ctx, args) {
    const action = args.action || null;
    const needsModal = ctx.isSlash && !args.text && (action === 'welcome' || action === 'closemsg');

    if (ctx.isSlash && !needsModal) await ctx.interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'open') return setSwitch(ctx, true);
    if (action === 'close') return setSwitch(ctx, false);
    if (action === 'welcome') return welcomeAction(ctx, args);
    if (action === 'closemsg') return closeAction(ctx, args);

    const cfg = await getGuildConfig(ctx.guild.id);
    const isOpen = cfg.modmailOpen !== false;
    return ctx.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(isOpen ? config.colors.success : config.colors.error)
          .setTitle('Modmail')
          .setDescription(
            `Modmail is currently **${isOpen ? 'open' : 'closed'}**.\n\n` +
              '`{prefix}modmail open` / `{prefix}modmail close`: turn new tickets on or off\n' +
              '`{prefix}modmail welcome`: edit the welcome message\n' +
              '`{prefix}modmail closemsg`: edit the close message'
          ),
      ],
    });
  },
};
