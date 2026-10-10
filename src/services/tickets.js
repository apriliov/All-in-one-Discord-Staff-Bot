const {
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  OverwriteType,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../config');
const embeds = require('../utils/embeds');
const TicketSettings = require('../database/models/TicketSettings');
const TicketPanel = require('../database/models/TicketPanel');
const SupportTicket = require('../database/models/SupportTicket');
const { getGuildConfig } = require('./guildConfig');
const { sendLog } = require('./cases');
const { getLevel, LEVELS } = require('../core/permissions');
const { truncate } = require('../utils/format');
const { slug, emojiObject } = require('../utils/parse');
const { fetchMessages, buildHtmlTranscript } = require('../utils/transcript');

const NO_PING = { parse: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(4, '0');

const PRIORITIES = {
  low: { emoji: '🟢', label: 'Low', color: 0x57f287 },
  normal: { emoji: '🟡', label: 'Normal', color: 0x5865f2 },
  high: { emoji: '🟠', label: 'High', color: 0xf0883e },
  urgent: { emoji: '🔴', label: 'Urgent', color: 0xed4245 },
};
const BUTTON_STYLES = { blurple: ButtonStyle.Primary, grey: ButtonStyle.Secondary, green: ButtonStyle.Success, red: ButtonStyle.Danger };

const DEFAULT_WELCOME = 'Hello {user}! Thanks for opening a ticket. Please describe your issue in as much detail as you can and a staff member will be with you shortly.';
const MEMBER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
];
const BOT_PERMS = [...MEMBER_PERMS, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages];

class TicketError extends Error {
  constructor(message, code = 'TICKET') {
    super(message);
    this.code = code;
  }
}

async function getSettings(guildId) {
  const run = () =>
    TicketSettings.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  try {
    return await run();
  } catch (err) {
    if (err && err.code === 11000) return run();
    throw err;
  }
}

const channelCache = new Set();
const activityStamp = new Map();
const isTicketChannel = (id) => channelCache.has(id);

async function loadTicketCache() {
  const open = await SupportTicket.find({ status: 'open' }, 'channelId').lean();
  channelCache.clear();
  for (const t of open) channelCache.add(t.channelId);
}

function noteActivity(channelId) {
  if (!channelCache.has(channelId)) return;
  const now = Date.now();
  if (now - (activityStamp.get(channelId) || 0) < 60 * 1000) return;
  activityStamp.set(channelId, now);
  SupportTicket.updateOne({ channelId, status: 'open' }, { lastActivityAt: new Date() }).catch(() => {});
}

const findSupportTicket = (guildId, channelId) => SupportTicket.findOne({ guildId, channelId, status: 'open' });

function supportRoleIds(guild, settings, topic, gcfg) {
  const picked =
    topic && topic.supportRoleIds && topic.supportRoleIds.length
      ? topic.supportRoleIds
      : settings.supportRoleIds.length
        ? settings.supportRoleIds
        : [...(gcfg.helperRoleIds || []), ...(gcfg.adminRoleIds || [])];
  return [...new Set(picked)].filter((id) => guild.roles.cache.has(id));
}

async function topicOf(ticket) {
  if (!ticket.panelId) return null;
  const panel = await TicketPanel.findOne({ guildId: ticket.guildId, panelId: ticket.panelId }).lean();
  return panel ? panel.topics.find((t) => t.key === ticket.topicKey) || null : null;
}

async function isStaffFor(guild, member, ticket) {
  if (!member) return false;
  const gcfg = await getGuildConfig(guild.id);
  if (getLevel(member, gcfg) >= LEVELS.helper) return true;
  const settings = await getSettings(guild.id);
  const topic = await topicOf(ticket);
  return supportRoleIds(guild, settings, topic, gcfg).some((id) => member.roles.cache.has(id));
}

/* ---------- panels ---------- */

function panelEmbed(panel) {
  const embed = new EmbedBuilder()
    .setColor(embeds.parseColor(panel.color))
    .setTitle(truncate(panel.title || 'Support Tickets', 256))
    .setDescription(truncate(panel.description || 'Select a topic below to open a ticket.', 4000));
  if (panel.image && embeds.isHttpUrl(panel.image)) embed.setImage(panel.image);
  if (panel.footer) embed.setFooter({ text: truncate(panel.footer, 2000) });
  return embed;
}

function panelComponents(panel) {
  const topics = panel.topics.slice(0, 25);
  if (!topics.length) return [];

  if (panel.style === 'menu') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`tk:menu:${panel.panelId}`)
      .setPlaceholder('Select a topic to open a ticket')
      .addOptions(
        topics.map((t) => {
          const option = { label: truncate(t.label, 100), value: t.key };
          if (t.description) option.description = truncate(t.description, 100);
          const emoji = emojiObject(t.emoji);
          if (emoji) option.emoji = emoji;
          return option;
        })
      );
    return [new ActionRowBuilder().addComponents(menu)];
  }

  const rows = [];
  for (let i = 0; i < topics.length; i += 5) {
    const row = new ActionRowBuilder();
    for (const t of topics.slice(i, i + 5)) {
      const button = new ButtonBuilder()
        .setCustomId(`tk:open:${panel.panelId}:${t.key}`)
        .setLabel(truncate(t.label, 80))
        .setStyle(BUTTON_STYLES[t.style] || ButtonStyle.Primary);
      const emoji = emojiObject(t.emoji);
      if (emoji) button.setEmoji(emoji);
      row.addComponents(button);
    }
    rows.push(row);
  }
  return rows;
}

const panelPayload = (panel) => ({ embeds: [panelEmbed(panel)], components: panelComponents(panel), allowedMentions: NO_PING });

async function postPanel(guild, panel, channel) {
  const message = await channel.send(panelPayload(panel));
  panel.channelId = channel.id;
  panel.messageId = message.id;
  await TicketPanel.updateOne({ _id: panel._id }, { channelId: channel.id, messageId: message.id });
  return message;
}

async function refreshPanel(guild, panel) {
  const channel = panel.channelId ? await guild.channels.fetch(panel.channelId).catch(() => null) : null;
  if (!channel || !channel.isTextBased()) return { ok: false, reason: 'The panel channel no longer exists.' };
  const message = panel.messageId ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
  if (message) {
    await message.edit(panelPayload(panel));
    return { ok: true, message };
  }
  return { ok: true, message: await postPanel(guild, panel, channel), reposted: true };
}

/* ---------- ticket message ---------- */

function renderVars(text, ticket, guild) {
  return String(text || '').replace(/\{(user|username|topic|server|number)\}/gi, (_, key) => {
    switch (key.toLowerCase()) {
      case 'user':
        return `<@${ticket.userId}>`;
      case 'username':
        return ticket.userTag;
      case 'topic':
        return ticket.topicLabel;
      case 'server':
        return guild ? guild.name : 'the server';
      default:
        return pad(ticket.number);
    }
  });
}

function controlPayload(ticket, { topic = null, claim = true, guild = null } = {}) {
  const prio = PRIORITIES[ticket.priority] || PRIORITIES.normal;
  const embed = new EmbedBuilder()
    .setColor(prio.color)
    .setTitle(`Ticket #${pad(ticket.number)} • ${truncate(ticket.topicLabel, 200)}`)
    .setDescription(truncate(renderVars((topic && topic.welcome) || DEFAULT_WELCOME, ticket, guild), 4000))
    .addFields(
      { name: 'Opened by', value: `<@${ticket.userId}>`, inline: true },
      { name: 'Priority', value: `${prio.emoji} ${prio.label}`, inline: true },
      { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody yet', inline: true }
    )
    .setTimestamp(ticket.createdAt || new Date());
  for (const a of (ticket.answers || []).slice(0, 5)) {
    embed.addFields({ name: truncate(a.q, 256), value: truncate(a.a || '-', 1024) });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tk:close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );
  if (claim) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('tk:claim')
        .setLabel(ticket.claimedBy ? 'Unclaim' : 'Claim')
        .setEmoji('🙋')
        .setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success)
    );
  }
  return { embeds: [embed], components: [row], allowedMentions: NO_PING };
}

async function updateControl(client, guild, ticket) {
  if (!ticket.controlMessageId) return false;
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(ticket.controlMessageId).catch(() => null) : null;
  if (!message) return false;
  const [settings, topic] = await Promise.all([getSettings(guild.id), topicOf(ticket)]);
  await message.edit(controlPayload(ticket, { topic, claim: settings.claim, guild })).catch(() => {});
  return true;
}

async function ticketLog(guild, payload) {
  const settings = await getSettings(guild.id);
  const gcfg = await getGuildConfig(guild.id);
  const target = settings.logChannelId || gcfg.logChannelId;
  if (target) await sendLog(guild, target, payload);
}

/* ---------- opening ---------- */

function channelName(pattern, { number, user, topic }) {
  const name = String(pattern || 'ticket-{number}')
    .replace(/\{number\}/gi, pad(number))
    .replace(/\{user\}/gi, slug(user.username, 20) || 'user')
    .replace(/\{topic\}/gi, slug(topic.key, 20) || 'ticket')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return name || `ticket-${pad(number)}`;
}

async function countOpen(guildId, userId) {
  return SupportTicket.find({ guildId, userId, status: 'open' }, 'channelId').lean();
}

async function createSupportTicket(client, guild, user, panel, topic, answers) {
  const settings = await getSettings(guild.id);
  const gcfg = await getGuildConfig(guild.id);

  const open = await countOpen(guild.id, user.id);
  if (open.length >= settings.maxOpen) {
    throw new TicketError(`You already have ${open.length} open ticket(s): ${open.map((t) => `<#${t.channelId}>`).join(' ')}\nPlease close one before opening another.`, 'LIMIT');
  }

  const roles = supportRoleIds(guild, settings, topic, gcfg);
  const parentId = topic.categoryId || settings.categoryId || null;
  const parent = parentId ? await guild.channels.fetch(parentId).catch(() => null) : null;
  const me = guild.members.me || (await guild.members.fetchMe());

  const counter = await TicketSettings.findOneAndUpdate({ guildId: guild.id }, { $inc: { counter: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const number = counter.counter;

  const overwrites = [
    { id: guild.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, type: OverwriteType.Member, allow: MEMBER_PERMS },
    { id: me.id, type: OverwriteType.Member, allow: BOT_PERMS },
    ...roles.map((id) => ({ id, type: OverwriteType.Role, allow: [...MEMBER_PERMS, PermissionFlagsBits.ManageMessages] })),
  ];

  const channel = await guild.channels.create({
    name: channelName(topic.namePattern || settings.namePattern, { number, user, topic }),
    type: ChannelType.GuildText,
    parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : null,
    topic: `Ticket #${pad(number)} | ${user.username} (${user.id}) | ${topic.label}`,
    permissionOverwrites: overwrites,
    reason: `Ticket #${pad(number)} opened by ${user.username}`,
  });

  let ticket;
  try {
    ticket = await SupportTicket.create({
      guildId: guild.id,
      number,
      userId: user.id,
      userTag: user.username,
      channelId: channel.id,
      panelId: panel.panelId,
      topicKey: topic.key,
      topicLabel: topic.label,
      answers,
      lastActivityAt: new Date(),
    });
  } catch (err) {
    await channel.delete('Ticket could not be saved').catch(() => {});
    throw err;
  }
  channelCache.add(channel.id);

  const pings = settings.pingSupport ? roles : [];
  const message = await channel
    .send({
      content: `<@${user.id}>${pings.length ? ` ${pings.map((id) => `<@&${id}>`).join(' ')}` : ''}`,
      ...controlPayload(ticket, { topic, claim: settings.claim, guild }),
      allowedMentions: { users: [user.id], roles: pings },
    })
    .catch((err) => {
      console.warn('[TICKETS] Could not send the ticket message:', err.message);
      return null;
    });
  if (message) {
    ticket.controlMessageId = message.id;
    await SupportTicket.updateOne({ _id: ticket._id }, { controlMessageId: message.id });
    await message.pin().catch(() => {});
  }

  await ticketLog(guild, {
    embeds: [
      new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`Ticket #${pad(number)} opened`)
        .addFields(
          { name: 'User', value: `<@${user.id}>\n\`${user.id}\``, inline: true },
          { name: 'Topic', value: truncate(topic.label, 200), inline: true },
          { name: 'Channel', value: `<#${channel.id}>`, inline: true }
        )
        .setTimestamp(),
    ],
  });
  return { ticket, channel };
}

/* ---------- closing ---------- */

function feedbackRow(ticket) {
  return new ActionRowBuilder().addComponents(
    [1, 2, 3, 4, 5].map((n) => new ButtonBuilder().setCustomId(`tk:fb:${ticket._id}:${n}`).setLabel(`${n} ⭐`).setStyle(ButtonStyle.Secondary))
  );
}

async function closeSupportTicket(client, guild, ticket, { closedBy = null, reason = null, auto = false } = {}) {
  const updated = await SupportTicket.findOneAndUpdate(
    { _id: ticket._id, status: 'open' },
    { status: 'closed', closedBy: closedBy ? closedBy.id : null, closedAt: new Date(), closeReason: reason },
    { new: true }
  );
  if (!updated) return { alreadyClosed: true };
  channelCache.delete(ticket.channelId);

  const settings = await getSettings(guild.id);
  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);

  const summary = new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`Ticket #${pad(ticket.number)} closed`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>\n\`${ticket.userId}\``, inline: true },
      { name: 'Topic', value: truncate(ticket.topicLabel, 200), inline: true },
      { name: 'Closed by', value: closedBy ? `<@${closedBy.id}>` : auto ? 'Automatic (inactivity)' : 'System', inline: true },
      { name: 'Claimed by', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Nobody', inline: true },
      { name: 'Reason', value: truncate(reason || 'No reason provided', 1000) }
    )
    .setTimestamp();

  let file = null;
  if (channel) {
    const messages = await fetchMessages(channel);
    const html = buildHtmlTranscript({ guildName: guild.name, ticket: updated, messages, closedBy, reason });
    file = Buffer.from(html, 'utf8');
  }
  const makeFile = () => new AttachmentBuilder(file, { name: `transcript-${pad(ticket.number)}.html` });

  await ticketLog(guild, { embeds: [summary], ...(file ? { files: [makeFile()] } : {}) });

  let userDmOk = false;
  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (user) {
    const dm = new EmbedBuilder()
      .setColor(config.colors.brand)
      .setTitle(`Your ticket #${pad(ticket.number)} was closed`)
      .setDescription(`**Server:** ${guild.name}\n**Topic:** ${truncate(ticket.topicLabel, 200)}\n**Reason:** ${truncate(reason || 'No reason provided', 900)}`)
      .setTimestamp();
    const payload = { embeds: [dm] };
    if (settings.dmTranscript && file) payload.files = [makeFile()];
    if (settings.feedback && !auto) {
      dm.setFooter({ text: 'How was the support you received? Rate it below.' });
      payload.components = [feedbackRow(updated)];
    }
    userDmOk = await user.send(payload).then(() => true, () => false);
  }

  if (channel) await channel.delete(`Ticket #${pad(ticket.number)} closed`).catch(() => {});
  return { alreadyClosed: false, userDmOk };
}

async function closeInactive(client) {
  const configured = await TicketSettings.find({ autoCloseHours: { $gt: 0 } }).lean();
  for (const settings of configured) {
    const guild = client.guilds.cache.get(settings.guildId);
    if (!guild) continue;
    const cutoff = new Date(Date.now() - settings.autoCloseHours * 60 * 60 * 1000);
    const stale = await SupportTicket.find({ guildId: settings.guildId, status: 'open', lastActivityAt: { $lt: cutoff } }).limit(20);
    for (const ticket of stale) {
      await closeSupportTicket(client, guild, ticket, { reason: `Closed automatically after ${settings.autoCloseHours} hour(s) without activity.`, auto: true }).catch((err) =>
        console.warn(`[TICKETS] Auto-close of #${ticket.number} failed:`, err.message)
      );
    }
  }
}

let autoTimer = null;
function startTicketScheduler(client) {
  loadTicketCache().catch((err) => console.warn('[TICKETS] Could not load the ticket cache:', err.message));
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => closeInactive(client).catch((err) => console.warn('[TICKETS] Auto-close error:', err.message)), 10 * 60 * 1000);
}

async function setClaim(client, guild, ticket, userId) {
  const updated = await SupportTicket.findOneAndUpdate({ _id: ticket._id, status: 'open' }, { claimedBy: userId }, { new: true });
  if (updated) await updateControl(client, guild, updated);
  return updated;
}

async function setPriority(client, guild, ticket, priority) {
  const updated = await SupportTicket.findOneAndUpdate({ _id: ticket._id, status: 'open' }, { priority }, { new: true });
  if (updated) await updateControl(client, guild, updated);
  return updated;
}

/* ---------- interactions ---------- */

async function say(interaction, embed, { ephemeral = true } = {}) {
  const payload = { embeds: [embed] };
  try {
    if (interaction.deferred && !interaction.replied) return await interaction.editReply(payload);
    if (interaction.replied || interaction.deferred) return await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
    return await interaction.reply({ ...payload, ...(ephemeral ? { flags: MessageFlags.Ephemeral } : {}) });
  } catch {
    return null;
  }
}

async function openAndReply(client, interaction, panel, topic, answers) {
  try {
    const { channel } = await createSupportTicket(client, interaction.guild, interaction.user, panel, topic, answers);
    await say(interaction, embeds.success(`Your ticket was created: <#${channel.id}>`));
  } catch (err) {
    if (err instanceof TicketError) return say(interaction, embeds.error(err.message));
    console.error('[TICKETS] Could not create a ticket:', err);
    const hint = err.code === 50013 ? 'I am missing permissions to create the ticket channel.' : err.code === 50035 || err.code === 30013 ? 'The ticket category is full or invalid. Please tell the staff.' : 'I could not create your ticket right now. Please try again later.';
    return say(interaction, embeds.error(hint));
  }
}

async function beginOpen(client, interaction, panelId, key) {
  const panel = await TicketPanel.findOne({ guildId: interaction.guildId, panelId });
  const topic = panel && panel.topics.find((t) => t.key === key);
  if (!panel || !topic) return say(interaction, embeds.error('This ticket panel is no longer available.'));

  const settings = await getSettings(interaction.guildId);
  const open = await countOpen(interaction.guildId, interaction.user.id);
  if (open.length >= settings.maxOpen) {
    return say(interaction, embeds.error(`You already have ${open.length} open ticket(s): ${open.map((t) => `<#${t.channelId}>`).join(' ')}\nPlease close one before opening another.`));
  }

  if (interaction.isStringSelectMenu()) interaction.message.edit({ components: panelComponents(panel) }).catch(() => {});

  if (topic.questions.length) {
    const modal = new ModalBuilder().setCustomId(`tk:modal:${panel.panelId}:${topic.key}`).setTitle(truncate(topic.label, 45));
    topic.questions.slice(0, 5).forEach((q, i) => {
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setLabel(truncate(q.label, 45))
            .setStyle(q.long ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setRequired(q.required !== false)
            .setMaxLength(q.long ? 1000 : 200)
        )
      );
    });
    return interaction.showModal(modal);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return openAndReply(client, interaction, panel, topic, []);
}

async function submitOpen(client, interaction, panelId, key) {
  const panel = await TicketPanel.findOne({ guildId: interaction.guildId, panelId });
  const topic = panel && panel.topics.find((t) => t.key === key);
  if (!panel || !topic) return say(interaction, embeds.error('This ticket panel is no longer available.'));

  const answers = topic.questions.slice(0, 5).map((q, i) => {
    let value = '';
    try {
      value = interaction.fields.getTextInputValue(`q${i}`);
    } catch {
      value = '';
    }
    return { q: q.label, a: value };
  });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return openAndReply(client, interaction, panel, topic, answers);
}

async function canClose(interaction, ticket) {
  if (await isStaffFor(interaction.guild, interaction.member, ticket)) return true;
  if (ticket.userId !== interaction.user.id) return false;
  return (await getSettings(interaction.guildId)).allowUserClose;
}

async function showCloseModal(interaction) {
  const ticket = await findSupportTicket(interaction.guildId, interaction.channelId);
  if (!ticket) return say(interaction, embeds.error('This is not an open ticket.'));
  if (!(await canClose(interaction, ticket))) return say(interaction, embeds.error('You cannot close this ticket.'));

  const modal = new ModalBuilder()
    .setCustomId('tk:closemodal')
    .setTitle(`Close ticket #${pad(ticket.number)}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Reason (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)
      )
    );
  return interaction.showModal(modal);
}

async function performClose(client, interaction, ticket, reason) {
  await sleep(5000);
  await closeSupportTicket(client, interaction.guild, ticket, { closedBy: interaction.user, reason });
}

async function submitClose(client, interaction) {
  const ticket = await findSupportTicket(interaction.guildId, interaction.channelId);
  if (!ticket) return say(interaction, embeds.error('This ticket is already closed.'));
  if (!(await canClose(interaction, ticket))) return say(interaction, embeds.error('You cannot close this ticket.'));

  const reason = interaction.fields.getTextInputValue('reason').trim() || null;
  await interaction.reply({ embeds: [embeds.info('🔒 Closing this ticket in 5 seconds.')] });
  return performClose(client, interaction, ticket, reason);
}

async function handleClaim(client, interaction) {
  const ticket = await findSupportTicket(interaction.guildId, interaction.channelId);
  if (!ticket) return say(interaction, embeds.error('This is not an open ticket.'));
  if (!(await isStaffFor(interaction.guild, interaction.member, ticket))) return say(interaction, embeds.error('Only staff can claim tickets.'));

  const gcfg = await getGuildConfig(interaction.guildId);
  const isAdmin = getLevel(interaction.member, gcfg) >= LEVELS.admin;
  let claimedBy;
  if (!ticket.claimedBy) claimedBy = interaction.user.id;
  else if (ticket.claimedBy === interaction.user.id || isAdmin) claimedBy = null;
  else return say(interaction, embeds.error(`This ticket is already claimed by <@${ticket.claimedBy}>.`));

  const updated = await SupportTicket.findOneAndUpdate({ _id: ticket._id, status: 'open' }, { claimedBy }, { new: true });
  const [settings, topic] = await Promise.all([getSettings(interaction.guildId), topicOf(updated)]);
  await interaction.update(controlPayload(updated, { topic, claim: settings.claim, guild: interaction.guild }));
  await interaction.channel
    .send({ embeds: [embeds.info(claimedBy ? `🙋 <@${claimedBy}> claimed this ticket.` : '🙋 This ticket is no longer claimed.')], allowedMentions: NO_PING })
    .catch(() => {});
}

async function handleCloseRequest(client, interaction, answer) {
  const ticket = await findSupportTicket(interaction.guildId, interaction.channelId);
  if (!ticket) return say(interaction, embeds.error('This ticket is already closed.'));
  const staff = await isStaffFor(interaction.guild, interaction.member, ticket);
  if (!staff && interaction.user.id !== ticket.userId) return say(interaction, embeds.error('Only the ticket owner can answer this.'));

  if (answer === 'no') {
    return interaction.update({ embeds: [embeds.info(`✋ <@${interaction.user.id}> wants to keep this ticket open.`)], components: [] });
  }
  await interaction.update({ embeds: [embeds.info('🔒 Closing this ticket in 5 seconds.')], components: [] });
  return performClose(client, interaction, ticket, 'Closed after a close request.');
}

async function handleFeedback(client, interaction) {
  const [, , id, rating] = interaction.customId.split(':');
  const ticket = await SupportTicket.findById(id).catch(() => null);
  if (!ticket || ticket.userId !== interaction.user.id) {
    return interaction.reply({ content: 'This rating is not for you.', flags: MessageFlags.Ephemeral }).catch(() => {});
  }
  if (ticket.rating) return interaction.update({ components: [] }).catch(() => {});

  const stars = Math.min(5, Math.max(1, Number(rating) || 1));
  await SupportTicket.updateOne({ _id: ticket._id }, { rating: stars });
  await interaction.update({ components: [], content: `⭐ Thanks for your feedback! You rated this ticket **${stars}/5**.` }).catch(() => {});

  const guild = client.guilds.cache.get(ticket.guildId);
  if (guild) {
    await ticketLog(guild, {
      embeds: [
        new EmbedBuilder()
          .setColor(config.colors.warn)
          .setTitle(`Ticket #${pad(ticket.number)} rated`)
          .setDescription(`<@${ticket.userId}> rated the support **${'⭐'.repeat(stars)}** (${stars}/5)${ticket.claimedBy ? `\nClaimed by <@${ticket.claimedBy}>` : ''}`)
          .setTimestamp(),
      ],
    });
  }
}

async function handleInteraction(client, interaction) {
  const id = interaction.customId;
  if (id.startsWith('tk:fb:')) return handleFeedback(client, interaction);

  if (!interaction.inGuild() || !config.isAllowedGuild(interaction.guildId)) {
    return say(interaction, embeds.error('Tickets only work inside the staff server.'));
  }

  const parts = id.split(':');
  switch (parts[1]) {
    case 'open':
      return beginOpen(client, interaction, Number(parts[2]), parts[3]);
    case 'menu':
      return beginOpen(client, interaction, Number(parts[2]), interaction.values[0]);
    case 'modal':
      return submitOpen(client, interaction, Number(parts[2]), parts[3]);
    case 'close':
      return showCloseModal(interaction);
    case 'closemodal':
      return submitClose(client, interaction);
    case 'claim':
      return handleClaim(client, interaction);
    case 'crq':
      return handleCloseRequest(client, interaction, parts[2]);
    default:
      return undefined;
  }
}

module.exports = {
  PRIORITIES,
  TicketError,
  getSettings,
  isTicketChannel,
  loadTicketCache,
  noteActivity,
  findSupportTicket,
  supportRoleIds,
  topicOf,
  isStaffFor,
  panelEmbed,
  panelPayload,
  postPanel,
  refreshPanel,
  controlPayload,
  updateControl,
  closeSupportTicket,
  setClaim,
  setPriority,
  startTicketScheduler,
  handleInteraction,
  pad,
};
