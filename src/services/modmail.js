const {
  ChannelType,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');
const GuildConfig = require('../database/models/GuildConfig');
const Case = require('../database/models/Case');
const Ticket = require('../database/models/Ticket');
const { getGuildConfig } = require('./guildConfig');
const { getMainGuild } = require('./mainGuild');
const { getLevel, LEVELS } = require('../core/permissions');
const { sendLog } = require('./cases');
const { ts, truncate } = require('../utils/format');
const { parseColor } = require('../utils/embeds');

const NO_PING = { parse: [] };
const CLOSE_BUTTON_ID = 'modmail:close';

function applyAttachments(embed, attachments) {
  const list = [...attachments];
  if (!list.length) return embed;
  const image = list.find((a) => a.contentType && a.contentType.startsWith('image/'));
  if (image) embed.setImage(image.url);
  const files = list.filter((a) => a !== image);
  if (files.length) embed.addFields({ name: 'Attachments', value: truncate(files.map((a) => a.url).join('\n'), 1000) });
  return embed;
}

const staffEmbed = (description, attachments = []) =>
  applyAttachments(
    new EmbedBuilder()
      .setColor(config.colors.white)
      .setAuthor({ name: 'Staff' })
      .setDescription(truncate(description, 4000) || '*(no text)*')
      .setTimestamp(),
    attachments
  );

const systemEmbed = (color, title, description) =>
  new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp();

const DEFAULT_WELCOME = {
  title: 'Welcome to Modmail',
  description:
    'Hi! This is the **Modmail** of {server}, a private way to contact the staff.\n\n' +
    'Please **describe the problem or question you have** in as much detail as you can. You can also send screenshots or other proof if needed.\n\n' +
    '• Every message you send here is passed on to the staff.\n' +
    '• The staff will reply in this DM as soon as possible, so please be patient.\n' +
    '• When your issue is solved, the staff will close this ticket. If you message again afterwards, a new ticket is opened automatically.',
  footer: 'Never send personal data such as passwords or verification codes.',
  color: null,
};

const DEFAULT_CLOSE =
  'Your modmail ticket has been **closed**. Thank you for contacting us.\n\n' +
  '**Reason:** {reason}\n\n' +
  'If you still need help, send a message here again and a new ticket will be opened automatically.';

function renderTemplate(text, { guild, user, reason } = {}) {
  return String(text || '').replace(/\{(server|user|username|reason)\}/gi, (_, key) => {
    switch (key.toLowerCase()) {
      case 'server':
        return guild ? guild.name : 'the server';
      case 'user':
        return user ? `<@${user.id}>` : 'there';
      case 'username':
        return user ? user.username : 'there';
      default:
        return reason || 'No reason provided';
    }
  });
}

const getWelcome = (cfg) => ({ ...DEFAULT_WELCOME, ...Object.fromEntries(Object.entries((cfg && cfg.modmailWelcome) || {}).filter(([, v]) => v)) });

function welcomeEmbed(guild, user, cfg) {
  const w = getWelcome(cfg);
  const embed = new EmbedBuilder()
    .setColor(parseColor(w.color))
    .setTitle(truncate(renderTemplate(w.title, { guild, user }), 256))
    .setThumbnail(guild.iconURL({ size: 128 }))
    .setDescription(truncate(renderTemplate(w.description, { guild, user }), 4000))
    .setTimestamp();
  if (w.footer) embed.setFooter({ text: truncate(renderTemplate(w.footer, { guild, user }), 2000) });
  return embed;
}

function closeText(cfg, { guild, user, reason }) {
  if (cfg && cfg.modmailCloseMsg) return truncate(renderTemplate(cfg.modmailCloseMsg, { guild, user, reason }), 4000);
  return (
    'Your modmail ticket has been **closed**. Thank you for contacting us.' +
    (reason ? `\n\n**Reason:** ${truncate(reason, 900)}` : '') +
    '\n\nIf you still need help, send a message here again and a new ticket will be opened automatically.'
  );
}

const closeRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_BUTTON_ID).setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

const findOpenTicket = (guildId, userId) => Ticket.findOne({ guildId, userId, status: 'open' });
const findTicketByChannel = (guildId, channelId) => Ticket.findOne({ guildId, channelId, status: 'open' });

async function getCategory(guild) {
  if (!config.modmail.categoryId) return null;
  const category = await guild.channels.fetch(config.modmail.categoryId).catch(() => null);
  return category && category.type === ChannelType.GuildCategory ? category : null;
}

async function getStaffLevel(guild, userId) {
  if (config.ownerIds.has(userId)) return LEVELS.owner;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return LEVELS.none;
  return getLevel(member, await getGuildConfig(guild.id));
}

const channelSlug = (name) => (String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20) || 'user');

async function buildInfoEmbed(guild, user, ticket) {
  const member = await guild.members.fetch(user.id).catch(() => null);
  const cases = await Case.countDocuments({ guildId: guild.id, userId: user.id });
  const embed = new EmbedBuilder()
    .setColor(config.colors.brand)
    .setTitle(`Ticket #${ticket.ticketId}`)
    .setDescription(
      'Type a normal message in this channel to reply to the user. It is sent to their DM as **Staff** (your name is not shown).\n' +
        'Start a message with `//` for an internal note that is not sent to the user.'
    )
    .setThumbnail(user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: 'User', value: `<@${user.id}>\n\`${user.id}\``, inline: true },
      { name: 'Account created', value: ts(user.createdAt), inline: true },
      { name: 'Joined server', value: member && member.joinedAt ? ts(member.joinedAt) : 'Unknown', inline: true },
      { name: 'Staff history', value: `${cases} case(s)`, inline: true },
      { name: 'Opened by', value: ticket.openedBy ? `<@${ticket.openedBy}>` : 'User (via DM)', inline: true }
    )
    .setFooter({ text: 'Press the button below or type {prefix}close to close the ticket.' })
    .setTimestamp();
  if (member) {
    const roles = [...member.roles.cache.filter((r) => r.id !== guild.id).sort((a, b) => b.position - a.position).values()];
    if (roles.length) embed.addFields({ name: 'Roles', value: truncate(roles.slice(0, 10).map(String).join(' '), 1000) });
  }
  return embed;
}

async function createTicket(guild, user, { openedBy = null } = {}) {
  const category = await getCategory(guild);
  if (!category) {
    const err = new Error('Modmail category not found.');
    err.code = 'NO_CATEGORY';
    throw err;
  }

  const cfg = await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $inc: { ticketCounter: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const ticketId = cfg.ticketCounter;

  const channel = await guild.channels.create({
    name: `ticket-${ticketId}-${channelSlug(user.username)}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Modmail | ${user.username} (${user.id}) | Ticket #${ticketId}`,
    reason: `Modmail ticket #${ticketId} for ${user.username}`,
  });

  let ticket;
  try {
    ticket = await Ticket.create({
      guildId: guild.id,
      ticketId,
      userId: user.id,
      userTag: user.username,
      channelId: channel.id,
      openedBy,
    });
  } catch (err) {
    await channel.delete('Ticket could not be saved').catch(() => {});
    throw err;
  }

  const adminRoleIds = (cfg.adminRoleIds || []).filter((id) => guild.roles.cache.has(id));
  const tags = adminRoleIds.map((id) => `<@&${id}>`).join(' ');
  await channel
    .send({
      content: tags ? `${tags} New modmail ticket.` : undefined,
      embeds: [await buildInfoEmbed(guild, user, ticket)],
      components: [closeRow()],
      allowedMentions: { parse: [], roles: adminRoleIds },
    })
    .catch((err) => console.warn('[MODMAIL] Could not send the ticket info:', err.message));
  return { ticket, channel };
}

async function fetchAllMessages(channel, max = 1000) {
  const all = [];
  let before;
  while (all.length < max) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch || !batch.size) break;
    all.push(...batch.values());
    before = batch.last().id;
  }
  return all.reverse();
}

function buildTranscript(ticket, messages) {
  const lines = [`Ticket #${ticket.ticketId} transcript | ${ticket.userTag} (${ticket.userId})`, ''];
  for (const m of messages) {
    const parts = [];
    if (m.content) parts.push(m.content);
    for (const e of m.embeds) {
      const who = e.author && e.author.name ? `${e.author.name}: ` : '';
      if (e.description) parts.push(`${who}${e.description}`);
      for (const f of e.fields || []) parts.push(`${f.name}: ${f.value}`);
    }
    for (const a of m.attachments.values()) parts.push(`[file] ${a.url}`);
    if (!parts.length) continue;
    lines.push(`[${m.createdAt.toISOString()}] ${m.author.username}: ${parts.join(' ')}`);
  }
  return lines.join('\n');
}

async function closeTicket(client, guild, ticket, { closedBy, reason = null }) {
  const updated = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: 'open' },
    { status: 'closed', closedBy: closedBy ? closedBy.id : null, closedAt: new Date(), closeReason: reason },
    { new: true }
  );
  if (!updated) return { alreadyClosed: true, staffDmOk: false, userDmOk: false };

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  const cfg = await getGuildConfig(guild.id);

  const summary = new EmbedBuilder()
    .setColor(config.colors.error)
    .setTitle(`Ticket #${ticket.ticketId} closed`)
    .addFields(
      { name: 'User', value: `<@${ticket.userId}>\n\`${ticket.userId}\``, inline: true },
      { name: 'Closed by', value: closedBy ? `<@${closedBy.id}>` : 'System', inline: true },
      { name: 'Reason', value: truncate(reason || 'No reason provided', 1000) }
    )
    .setTimestamp();

  let staffDmOk = false;
  if (channel) {
    const transcript = Buffer.from(buildTranscript(ticket, await fetchAllMessages(channel)), 'utf8');
    const makeFile = () => new AttachmentBuilder(transcript, { name: `ticket-${ticket.ticketId}-transcript.txt` });

    if (closedBy) {
      const dmEmbed = EmbedBuilder.from(summary).setDescription('Here is the full transcript of the ticket you closed.');
      staffDmOk = await closedBy.send({ embeds: [dmEmbed], files: [makeFile()] }).then(() => true, () => false);
    }

    if (cfg.logChannelId) await sendLog(guild, cfg.logChannelId, { embeds: [summary], files: [makeFile()] });
  }

  let userDmOk = false;
  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (user) {
    const text = closeText(cfg, { guild, user, reason });
    userDmOk = await user.send({ embeds: [staffEmbed(text)] }).then(() => true, () => false);
  }

  if (channel) await channel.delete(`Ticket #${ticket.ticketId} closed`).catch(() => {});
  return { alreadyClosed: false, staffDmOk, userDmOk };
}

function userMessageEmbed(message) {
  return applyAttachments(
    new EmbedBuilder()
      .setColor(config.colors.brand)
      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
      .setDescription(truncate(message.content, 4000) || '*(no text)*')
      .setTimestamp(),
    message.attachments.values()
  );
}

const dmQueues = new Map();
function handleDirectMessage(client, message) {
  const key = message.author.id;
  const next = (dmQueues.get(key) || Promise.resolve()).catch(() => {}).then(() => processDirectMessage(client, message));
  dmQueues.set(key, next);
  return next.finally(() => {
    if (dmQueues.get(key) === next) dmQueues.delete(key);
  });
}

async function processDirectMessage(client, message) {
  const guild = getMainGuild(client);
  if (!guild) return;
  const user = message.author;
  const reply = (embed) => user.send({ embeds: [embed] }).catch(() => {});
  const cfg = await getGuildConfig(guild.id);

  if ((cfg.modmailBlocked || []).includes(user.id)) {
    return reply(systemEmbed(config.colors.error, 'Modmail unavailable', 'You cannot contact the staff through modmail.'));
  }

  let ticket = await findOpenTicket(guild.id, user.id);
  let channel = ticket ? await guild.channels.fetch(ticket.channelId).catch(() => null) : null;
  if (ticket && !channel) {
    await Ticket.updateOne({ _id: ticket._id }, { status: 'closed', closedAt: new Date(), closeReason: 'Channel deleted' });
    ticket = null;
  }

  if (!ticket) {
    if (cfg.modmailOpen === false) {
      return reply(systemEmbed(config.colors.warn, 'Modmail is closed', 'Modmail is closed right now, so I cannot open a new ticket. Please try again later.'));
    }
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return reply(systemEmbed(config.colors.error, 'Modmail unavailable', 'You need to be a member of the server to use modmail.'));

    try {
      ({ ticket, channel } = await createTicket(guild, user));
    } catch (err) {
      console.error(`[MODMAIL] Could not create a ticket (code: ${err.code || 'none'}):`, err.stack || err.message);

      if (cfg.logChannelId) {
        const hint =
          err.code === 'NO_CATEGORY'
            ? `The modmail category \`${config.modmail.categoryId || 'not set'}\` was not found or is not a category. Check MODMAIL_CATEGORY_ID.`
            : err.code === 50013
              ? 'The bot is missing the **Manage Channels** permission in the modmail category.'
              : truncate(String(err.message), 500);
        await sendLog(guild, cfg.logChannelId, {
          embeds: [systemEmbed(config.colors.error, 'Modmail: ticket creation failed', `User: <@${user.id}> (\`${user.id}\`)\n${hint}`)],
          allowedMentions: NO_PING,
        }).catch(() => {});
      }
      return reply(systemEmbed(config.colors.error, 'Modmail unavailable', 'I could not open a ticket right now. Please try again later.'));
    }
    await reply(welcomeEmbed(guild, user, cfg));
  }

  try {
    await channel.send({ embeds: [userMessageEmbed(message)], allowedMentions: NO_PING });
    await message.react('✅').catch(() => {});
  } catch (err) {
    console.error('[MODMAIL] Could not forward a DM:', err.message);
    await message.react('❌').catch(() => {});
  }
}

async function forwardStaffMessage(client, message) {
  if (!message.guild || message.author.bot || message.system) return;
  if (!config.modmail.categoryId || message.channel.parentId !== config.modmail.categoryId) return;
  const text = message.content.trim();
  if (text.startsWith('//')) return;
  if (!text && !message.attachments.size) return;

  const ticket = await findTicketByChannel(message.guild.id, message.channel.id);
  if (!ticket) return;
  if ((await getStaffLevel(message.guild, message.author.id)) < LEVELS.helper) return;

  const user = await client.users.fetch(ticket.userId).catch(() => null);
  const sent = user ? await user.send({ embeds: [staffEmbed(text, message.attachments.values())] }).then(() => true, () => false) : false;
  if (sent) return message.react('✅').catch(() => {});

  await message.react('❌').catch(() => {});
  await message
    .reply({
      embeds: [systemEmbed(config.colors.error, 'Message not delivered', 'I could not DM this user (their DMs are closed or they blocked the bot).')],
      allowedMentions: NO_PING,
    })
    .catch(() => {});
}

module.exports = {
  CLOSE_BUTTON_ID,
  staffEmbed,
  systemEmbed,
  welcomeEmbed,
  getWelcome,
  closeText,
  renderTemplate,
  DEFAULT_WELCOME,
  DEFAULT_CLOSE,
  findOpenTicket,
  findTicketByChannel,
  getCategory,
  getStaffLevel,
  createTicket,
  closeTicket,
  handleDirectMessage,
  forwardStaffMessage,
  NO_PING,
};
