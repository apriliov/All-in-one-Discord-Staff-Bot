const { EmbedBuilder, ActivityType, escapeMarkdown } = require('discord.js');
const config = require('../config');
const StatusPage = require('../database/models/StatusPage');
const GuildConfig = require('../database/models/GuildConfig');

const REFRESH_MS = 5000;
const DEBOUNCE_MS = 500;

const STATUS_META = {
  online: { icon: '🟢', label: 'Online', color: 0x57f287 },
  idle: { icon: '🌙', label: 'Idle', color: 0xfee75c },
  dnd: { icon: '⛔', label: 'Do Not Disturb', color: 0xed4245 },
  offline: { icon: '⚫', label: 'Offline', color: 0x747f8d },
};
const DEVICES = { desktop: '🖥️ Desktop', mobile: '📱 Mobile', web: '🌐 Web' };

const state = { pages: new Map(), timer: null, debounce: null, busy: false };

const clip = (text, max) => (text && text.length > max ? `${text.slice(0, max - 1)}…` : text || '');
const md = (text, max = 80) => escapeMarkdown(clip(text, max));

const isTracked = (userId) => !!userId && (userId === config.statusTargets.userId || userId === config.statusTargets.botId);

const SYNC_MS = 60_000;
const lastSync = new Map();
const notInGuild = new Set();

async function syncPresences(client, guild, force = false) {
  if (!force && Date.now() - (lastSync.get(guild.id) || 0) < SYNC_MS) return;
  lastSync.set(guild.id, Date.now());

  const ids = [config.statusTargets.userId, config.statusTargets.botId].filter((id) => id && id !== client.user.id);
  let found = null;
  try {
    found = await guild.members.fetch({ user: ids, withPresences: true, time: 8000 });
  } catch (err) {
    console.warn('[STATUS] Could not request presences:', err.message);

    found = new Map();
    for (const id of ids) {
      const m = await guild.members.fetch(id).catch(() => null);
      if (m) found.set(id, m);
    }
  }
  for (const id of ids) {
    const key = `${guild.id}:${id}`;
    if (found.has(id)) notInGuild.delete(key);
    else notInGuild.add(key);
  }
}

function readPresence(client, guild, id) {
  if (id === client.user.id) {
    const p = client.user.presence;
    return { status: p?.status || 'online', activities: p?.activities || [], clientStatus: null, missing: false };
  }
  if (notInGuild.has(`${guild.id}:${id}`)) return { status: 'offline', activities: [], clientStatus: null, missing: true };
  const p = guild.presences.cache.get(id);
  const status = p?.status || 'offline';
  return { status, activities: status === 'offline' ? [] : p?.activities || [], clientStatus: status === 'offline' ? null : p?.clientStatus || null, missing: false };
}

function formatActivity(a) {
  const lines = [];
  switch (a.type) {
    case ActivityType.Custom: {
      const e = a.emoji ? (a.emoji.id ? `<${a.emoji.animated ? 'a' : ''}:${a.emoji.name}:${a.emoji.id}>` : a.emoji.name) : '';
      const text = [e, a.state ? md(a.state, 100) : ''].filter(Boolean).join(' ');
      return text ? `💬 ${text}` : null;
    }
    case ActivityType.Playing:
      lines.push(`🎮 Playing **${md(a.name)}**`);
      break;
    case ActivityType.Streaming:
      lines.push(`📺 Streaming **${md(a.name)}**${a.url ? ` — ${a.url}` : ''}`);
      break;
    case ActivityType.Listening:
      lines.push(`🎧 Listening to **${md(a.name)}**`);
      break;
    case ActivityType.Watching:
      lines.push(`👀 Watching **${md(a.name)}**`);
      break;
    case ActivityType.Competing:
      lines.push(`🏆 Competing in **${md(a.name)}**`);
      break;
    default:
      lines.push(`✨ **${md(a.name)}**`);
  }
  if (a.details) lines.push(`> ${md(a.details)}`);
  if (a.state) lines.push(`> ${md(a.state)}`);
  return lines.join('\n');
}

const activitiesText = (activities, max = 700) => {
  const out = activities.slice(0, 4).map(formatActivity).filter(Boolean).join('\n\n');
  return clip(out, max) || '*No activity*';
};

const failedUntil = new Map();
async function getUser(client, id) {
  if (!id) return null;
  if (failedUntil.get(id) > Date.now()) return null;
  const user = await client.users.fetch(id).catch(() => null);
  if (!user) failedUntil.set(id, Date.now() + 60_000);
  return user;
}

function block(id, p) {
  if (!id) return 'Not configured. Set STATUS_USER_ID / STATUS_BOT_ID in your .env file.';
  if (p.missing) return `<@${id}>\n⚠️ Not a member of this server, so Discord does not share its status.`;
  const meta = STATUS_META[p.status] || STATUS_META.offline;
  const devices = p.clientStatus ? Object.keys(p.clientStatus).map((d) => DEVICES[d]).filter(Boolean).join(' · ') : '';
  return [
    `<@${id}>`,
    `${meta.icon} **${meta.label}**${devices ? `  ·  ${devices}` : ''}`,
    '',
    '**Activity**',
    activitiesText(p.activities),
  ].join('\n');
}

async function readModmail(guild) {
  const cfg = await GuildConfig.findOne({ guildId: guild.id }).lean().catch(() => null);
  return !cfg || cfg.modmailOpen !== false;
}

async function buildEmbeds(client, guild) {
  const { userId, botId } = config.statusTargets;
  syncPresences(client, guild).catch(() => {});
  const [user, bot, modmailOpen] = await Promise.all([getUser(client, userId), getUser(client, botId), readModmail(guild)]);
  const u = readPresence(client, guild, userId);
  const b = readPresence(client, guild, botId);

  const ownerEmbed = new EmbedBuilder()
    .setColor((STATUS_META[u.status] || STATUS_META.offline).color)
    .setTitle(`👤  OWNER  •  ${md(user?.username || 'Unknown', 40)}`)
    .setDescription(block(userId, u));
  if (user) ownerEmbed.setThumbnail(user.displayAvatarURL({ size: 128 }));

  const botEmbed = new EmbedBuilder()
    .setColor((STATUS_META[b.status] || STATUS_META.offline).color)
    .setTitle(`🤖  BOT  •  ${md(bot?.username || 'Unknown', 40)}`)
    .setDescription(block(botId, b));
  if (bot) botEmbed.setThumbnail(bot.displayAvatarURL({ size: 128 }));

  const modmailEmbed = new EmbedBuilder()
    .setColor(modmailOpen ? config.colors.success : config.colors.error)
    .setTitle('📬  MODMAIL')
    .setDescription(modmailOpen ? '🟢 **Open**\nNew tickets can be opened.' : '🔴 **Offline**\nNo new tickets right now. Existing tickets keep working.')
    .setFooter({ text: 'Live • updates automatically' });

  const list = [ownerEmbed, botEmbed, modmailEmbed];
  const hash = JSON.stringify(list.map((e) => e.toJSON()));
  modmailEmbed.setTimestamp();
  return { embeds: list, hash };
}

async function removePage(page) {
  state.pages.delete(page.messageId);
  await StatusPage.deleteOne({ messageId: page.messageId }).catch(() => {});
}

async function updatePage(client, page) {
  if (page.nextTry && Date.now() < page.nextTry) return;
  const guild = client.guilds.cache.get(page.guildId);
  if (!guild) return;

  const { embeds, hash } = await buildEmbeds(client, guild);
  if (hash === page.hash) return;

  try {
    const channel = client.channels.cache.get(page.channelId) || (await client.channels.fetch(page.channelId));
    await channel.messages.edit(page.messageId, { embeds, allowedMentions: { parse: [] } });
    page.hash = hash;
    page.nextTry = 0;
  } catch (err) {
    if (err.code === 10003 || err.code === 10008) return removePage(page);
    page.nextTry = Date.now() + 30_000;
    console.warn(`[STATUS] Could not edit the status page in ${page.channelId}:`, err.message);
  }
}

async function refreshAll(client) {
  if (state.busy) return;
  state.busy = true;
  try {
    for (const page of [...state.pages.values()]) await updatePage(client, page);
  } catch (err) {
    console.warn('[STATUS] Refresh failed:', err.message);
  } finally {
    state.busy = false;
  }
}

function scheduleRefresh(client) {
  if (state.debounce || !state.pages.size) return;
  state.debounce = setTimeout(() => {
    state.debounce = null;
    refreshAll(client);
  }, DEBOUNCE_MS);
}

async function startStatusPages(client) {
  const saved = await StatusPage.find().lean();
  for (const p of saved) state.pages.set(p.messageId, { guildId: p.guildId, channelId: p.channelId, messageId: p.messageId, hash: null, nextTry: 0 });
  console.log(`[STATUS] ${saved.length} status page(s) loaded.`);
  for (const gid of new Set(saved.map((p) => p.guildId))) {
    const guild = client.guilds.cache.get(gid);
    if (guild) await syncPresences(client, guild, true).catch(() => {});
  }
  await refreshAll(client);
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => refreshAll(client), REFRESH_MS);
}

async function createStatusPage(client, guild, channel) {
  await syncPresences(client, guild, true).catch(() => {});
  const { embeds, hash } = await buildEmbeds(client, guild);
  const message = await channel.send({ embeds, allowedMentions: { parse: [] } });

  const old = await StatusPage.findOneAndDelete({ guildId: guild.id, channelId: channel.id });
  if (old) {
    state.pages.delete(old.messageId);
    await channel.messages.delete(old.messageId).catch(() => {});
  }
  await StatusPage.create({ guildId: guild.id, channelId: channel.id, messageId: message.id });
  state.pages.set(message.id, { guildId: guild.id, channelId: channel.id, messageId: message.id, hash, nextTry: 0 });
  return message;
}

async function removePageByMessage(messageId) {
  const page = state.pages.get(messageId);
  if (page) await removePage(page);
}

async function removePagesByChannel(channelId) {
  for (const page of [...state.pages.values()]) if (page.channelId === channelId) await removePage(page);
}

module.exports = { startStatusPages, createStatusPage, scheduleRefresh, isTracked, removePageByMessage, removePagesByChannel };
