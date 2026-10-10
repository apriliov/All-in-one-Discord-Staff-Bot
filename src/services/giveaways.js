const crypto = require('node:crypto');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Giveaway = require('../database/models/Giveaway');
const GuildConfig = require('../database/models/GuildConfig');
const config = require('../config');
const embeds = require('../utils/embeds');
const { getGuildConfig } = require('./guildConfig');
const { sendLog } = require('./cases');
const { truncate } = require('../utils/format');
const { formatDuration } = require('../utils/duration');

const ENTER_PREFIX = 'gw:enter:';
const LEAVE_PREFIX = 'gw:leave:';
const unix = (date) => Math.floor(new Date(date).getTime() / 1000);
const mention = (ids) => ids.map((id) => `<@${id}>`).join(', ');
const jumpLink = (g) => (g.messageId ? `https://discord.com/channels/${g.guildId}/${g.channelId}/${g.messageId}` : null);

function requirementLines(g) {
  const lines = [];
  if (g.requiredRoleId) lines.push(`**Requires:** <@&${g.requiredRoleId}>`);
  if (g.bonusRoleId && g.bonusEntries > 1) lines.push(`**Bonus:** <@&${g.bonusRoleId}> gets ${g.bonusEntries}x entries`);
  return lines;
}

function buildEmbed(g) {
  const embed = new EmbedBuilder().setTitle(truncate(g.prize, 256)).setColor(embeds.parseColor(g.color, config.colors.brand));
  const lines = [];
  if (g.description) lines.push(g.description, '');

  if (g.status === 'ended') {
    embed.setColor(config.colors.neutral);
    lines.push(`**Winners:** ${g.winners.length ? mention(g.winners) : 'No valid entrants'}`);
    lines.push(`**Ended:** <t:${unix(g.endedAt || g.endsAt)}:R>`);
  } else if (g.status === 'paused') {
    embed.setColor(config.colors.warn);
    lines.push('⏸️ **This giveaway is paused.**', `**Time left:** ${formatDuration(g.remainingMs || 0)}`, `**Winners:** ${g.winnerCount}`);
  } else {
    lines.push('Click the button below to enter!', '', `**Ends:** <t:${unix(g.endsAt)}:R> (<t:${unix(g.endsAt)}:f>)`, `**Winners:** ${g.winnerCount}`);
  }
  lines.push(`**Hosted by:** <@${g.hostId}>`, ...requirementLines(g), `**Entries:** ${g.entrants.length}`);

  embed.setDescription(truncate(lines.join('\n'), 4000));
  if (g.imageUrl && embeds.isHttpUrl(g.imageUrl)) embed.setImage(g.imageUrl);
  embed.setFooter({ text: `Giveaway #${g.giveawayId}${g.status === 'ended' ? ' • Ended' : ' • Ends at'}` });
  if (g.status !== 'paused') embed.setTimestamp(g.status === 'ended' ? g.endedAt || g.endsAt : g.endsAt);
  return embed;
}

function buildRow(g) {
  const button = new ButtonBuilder().setCustomId(`${ENTER_PREFIX}${g.giveawayId}`).setStyle(ButtonStyle.Primary).setEmoji('🎉');
  if (g.status === 'ended') button.setLabel(`Ended (${g.entrants.length})`).setStyle(ButtonStyle.Secondary).setDisabled(true);
  else if (g.status === 'paused') button.setLabel('Paused').setStyle(ButtonStyle.Secondary).setDisabled(true);
  else button.setLabel(`Enter (${g.entrants.length})`);
  return new ActionRowBuilder().addComponents(button);
}

const headline = (g) => (g.status === 'ended' ? '🎉 **GIVEAWAY ENDED** 🎉' : g.status === 'paused' ? '⏸️ **GIVEAWAY PAUSED** ⏸️' : '🎉 **GIVEAWAY** 🎉');
const messagePayload = (g) => ({ content: headline(g), embeds: [buildEmbed(g)], components: [buildRow(g)], allowedMentions: { parse: [] } });

async function fetchGiveawayMessage(client, g) {
  if (!g.messageId) return null;
  const channel = client.channels.cache.get(g.channelId) || (await client.channels.fetch(g.channelId).catch(() => null));
  if (!channel || !channel.isTextBased()) return null;
  return channel.messages.fetch(g.messageId).catch(() => null);
}

async function refreshMessage(client, g) {
  const message = await fetchGiveawayMessage(client, g);
  if (!message) return false;
  await message.edit(messagePayload(g)).catch((err) => console.warn('[GIVEAWAY] Could not edit the message:', err.message));
  return true;
}

const pending = new Map();
function scheduleRefresh(client, g) {
  const key = `${g.guildId}:${g.giveawayId}`;
  if (pending.has(key)) return;
  pending.set(
    key,
    setTimeout(async () => {
      pending.delete(key);
      const fresh = await Giveaway.findById(g._id).catch(() => null);
      if (fresh) await refreshMessage(client, fresh);
    }, 4000)
  );
}

async function createGiveaway(client, guild, channel, data) {
  const cfg = await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $inc: { giveawayCounter: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const g = await Giveaway.create({ ...data, guildId: guild.id, giveawayId: cfg.giveawayCounter, channelId: channel.id });
  try {
    const message = await channel.send(messagePayload(g));
    g.messageId = message.id;
    await g.save();
  } catch (err) {
    await Giveaway.deleteOne({ _id: g._id });
    throw err;
  }
  return g;
}

async function pickWinners(guild, g, count, exclude = new Set()) {
  const bonus = new Set(g.bonusUsers || []);
  const weight = Math.max(1, g.bonusEntries || 1);
  const pool = g.entrants.filter((id) => !exclude.has(id)).map((id) => ({ id, w: bonus.has(id) ? weight : 1 }));
  const picked = [];

  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let roll = crypto.randomInt(0, total);
    let index = 0;
    for (; index < pool.length; index++) {
      roll -= pool[index].w;
      if (roll < 0) break;
    }
    const [candidate] = pool.splice(Math.min(index, pool.length - 1), 1);
    const member = await guild.members.fetch(candidate.id).catch(() => null);
    if (!member || member.user.bot) continue;
    if (g.requiredRoleId && !member.roles.cache.has(g.requiredRoleId)) continue;
    picked.push(candidate.id);
  }
  return picked;
}

async function announce(client, guild, g, winners, { reroll = false } = {}) {
  const channel = await guild.channels.fetch(g.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const link = jumpLink(g);
  const content = winners.length
    ? `${reroll ? '🔁 New winner(s):' : '🎉 Congratulations'} ${mention(winners)}! You won **${truncate(g.prize, 200)}**!`
    : `No valid entrants for **${truncate(g.prize, 200)}**, so a winner could not be determined.`;
  await channel
    .send({
      content: truncate(content, 1900),
      reply: g.messageId ? { messageReference: g.messageId, failIfNotExists: false } : undefined,
      allowedMentions: { users: winners },
    })
    .catch((err) => console.warn('[GIVEAWAY] Could not announce the winners:', err.message));

  for (const id of winners) {
    const user = await client.users.fetch(id).catch(() => null);
    if (!user) continue;
    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('🎉 You won a giveaway!')
      .setDescription(`**Prize:** ${truncate(g.prize, 200)}\n**Server:** ${guild.name}${link ? `\n[Jump to the giveaway](${link})` : ''}`)
      .setTimestamp();
    await user.send({ embeds: [embed] }).catch(() => {});
  }
}

async function endGiveaway(client, ref) {
  const g = await Giveaway.findOneAndUpdate(
    { _id: ref._id || ref, status: { $in: ['active', 'paused'] } },
    { status: 'ended', endedAt: new Date(), remainingMs: null },
    { new: true }
  );
  if (!g) return null;

  const guild = client.guilds.cache.get(g.guildId) || (await client.guilds.fetch(g.guildId).catch(() => null));
  if (!guild) return g;

  const winners = await pickWinners(guild, g, g.winnerCount);
  g.winners = winners;
  await Giveaway.updateOne({ _id: g._id }, { winners });

  if (!(await refreshMessage(client, g))) {
    const channel = await guild.channels.fetch(g.channelId).catch(() => null);
    if (channel && channel.isTextBased()) await channel.send(messagePayload(g)).catch(() => {});
  }
  await announce(client, guild, g, winners);

  const cfg = await getGuildConfig(guild.id);
  await sendLog(guild, cfg.logChannelId, {
    embeds: [
      new EmbedBuilder()
        .setColor(config.colors.brand)
        .setTitle(`Giveaway #${g.giveawayId} ended`)
        .setDescription(`**Prize:** ${truncate(g.prize, 200)}\n**Entries:** ${g.entrants.length}\n**Winners:** ${winners.length ? mention(winners) : 'none'}`)
        .setTimestamp(),
    ],
  });
  return g;
}

async function rerollGiveaway(client, guild, g, count) {
  const exclude = new Set(g.winners);
  const picked = await pickWinners(guild, g, count, exclude);
  if (!picked.length) return [];
  g.winners = [...g.winners, ...picked];
  await Giveaway.updateOne({ _id: g._id }, { winners: g.winners });
  await refreshMessage(client, g);
  await announce(client, guild, g, picked, { reroll: true });
  return picked;
}

async function togglePause(client, g) {
  if (g.status === 'active') {
    const remaining = Math.max(1000, new Date(g.endsAt).getTime() - Date.now());
    const updated = await Giveaway.findOneAndUpdate({ _id: g._id, status: 'active' }, { status: 'paused', remainingMs: remaining }, { new: true });
    if (updated) await refreshMessage(client, updated);
    return updated;
  }
  if (g.status === 'paused') {
    const endsAt = new Date(Date.now() + (g.remainingMs || 1000));
    const updated = await Giveaway.findOneAndUpdate({ _id: g._id, status: 'paused' }, { status: 'active', endsAt, remainingMs: null }, { new: true });
    if (updated) await refreshMessage(client, updated);
    return updated;
  }
  return null;
}

const refuse = (interaction, text) => interaction.reply({ embeds: [embeds.error(text)], flags: MessageFlags.Ephemeral }).catch(() => {});

async function handleEnter(client, interaction, giveawayId) {
  const g = await Giveaway.findOne({ guildId: interaction.guildId, giveawayId });
  if (!g || g.status === 'ended') return refuse(interaction, 'This giveaway has already ended.');
  if (g.status === 'paused') return refuse(interaction, 'This giveaway is paused right now.');

  const member = interaction.member;
  if (g.requiredRoleId && !(member && member.roles && member.roles.cache.has(g.requiredRoleId))) {
    return refuse(interaction, `You need the <@&${g.requiredRoleId}> role to enter this giveaway.`);
  }

  const userId = interaction.user.id;
  if (g.entrants.includes(userId)) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`${LEAVE_PREFIX}${giveawayId}`).setLabel('Leave giveaway').setStyle(ButtonStyle.Danger)
    );
    return interaction
      .reply({ embeds: [embeds.info('You have already entered this giveaway.')], components: [row], flags: MessageFlags.Ephemeral })
      .catch(() => {});
  }

  const hasBonus = !!(g.bonusRoleId && g.bonusEntries > 1 && member && member.roles.cache.has(g.bonusRoleId));
  const update = { $push: { entrants: userId } };
  if (hasBonus) update.$addToSet = { bonusUsers: userId };
  const updated = await Giveaway.findOneAndUpdate({ _id: g._id, status: 'active', entrants: { $ne: userId } }, update, { new: true });
  if (!updated) return refuse(interaction, 'Could not enter the giveaway. It may have just ended.');

  scheduleRefresh(client, updated);
  return interaction
    .reply({
      embeds: [embeds.success(`You entered the giveaway for **${truncate(g.prize, 200)}**!${hasBonus ? ` You have **${g.bonusEntries}x** entries.` : ''}`)],
      flags: MessageFlags.Ephemeral,
    })
    .catch(() => {});
}

async function handleLeave(client, interaction, giveawayId) {
  const updated = await Giveaway.findOneAndUpdate(
    { guildId: interaction.guildId, giveawayId, status: 'active' },
    { $pull: { entrants: interaction.user.id, bonusUsers: interaction.user.id } },
    { new: true }
  );
  if (!updated) return interaction.update({ embeds: [embeds.error('This giveaway is no longer active.')], components: [] }).catch(() => {});
  scheduleRefresh(client, updated);
  return interaction.update({ embeds: [embeds.success('You left the giveaway.')], components: [] }).catch(() => {});
}

async function handleInteraction(client, interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.inGuild() || !config.isAllowedGuild(interaction.guildId)) return refuse(interaction, 'This only works in the staff server.');
  const id = interaction.customId;
  if (id.startsWith(ENTER_PREFIX)) return handleEnter(client, interaction, Number(id.slice(ENTER_PREFIX.length)));
  if (id.startsWith(LEAVE_PREFIX)) return handleLeave(client, interaction, Number(id.slice(LEAVE_PREFIX.length)));
}

let timer = null;
async function tick(client) {
  const due = await Giveaway.find({ status: 'active', endsAt: { $lte: new Date() } }).limit(25);
  for (const g of due) {
    await endGiveaway(client, g).catch((err) => console.error(`[GIVEAWAY] Could not end #${g.giveawayId}:`, err));
  }
}

function startGiveawayScheduler(client) {
  if (timer) clearInterval(timer);
  const run = () => tick(client).catch((err) => console.warn('[GIVEAWAY] Scheduler error:', err.message));
  timer = setInterval(run, 10 * 1000);
  run();
}

module.exports = {
  buildEmbed,
  buildRow,
  messagePayload,
  jumpLink,
  createGiveaway,
  endGiveaway,
  rerollGiveaway,
  togglePause,
  refreshMessage,
  fetchGiveawayMessage,
  handleInteraction,
  startGiveawayScheduler,
};
