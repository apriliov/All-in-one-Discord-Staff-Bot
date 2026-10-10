const { EmbedBuilder } = require('discord.js');
const GuildConfig = require('../database/models/GuildConfig');
const Case = require('../database/models/Case');
const { colors } = require('../config');
const { ts, truncate } = require('../utils/format');
const { formatDuration } = require('../utils/duration');

const TYPE_META = {
  warn: { label: 'Warn', color: colors.warn },
  note: { label: 'Note', color: colors.neutral },
  timeout: { label: 'Timeout', color: colors.mod },
  untimeout: { label: 'Timeout removed', color: colors.success },
  kick: { label: 'Kick', color: colors.error },
  softban: { label: 'Softban', color: colors.error },
  ban: { label: 'Ban', color: colors.error },
  unban: { label: 'Unban', color: colors.success },
};

function caseEmbed(doc) {
  const meta = TYPE_META[doc.type];
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`Case #${doc.caseId} | ${meta.label}`)
    .addFields(
      { name: 'User', value: `<@${doc.userId}>\n\`${doc.userId}\``, inline: true },
      { name: 'Staff member', value: `<@${doc.moderatorId}>\n\`${doc.moderatorId}\``, inline: true }
    )
    .setTimestamp(doc.createdAt || new Date());
  if (doc.duration) embed.addFields({ name: 'Duration', value: formatDuration(doc.duration), inline: true });
  embed.addFields({ name: 'Reason', value: truncate(doc.reason, 1000) || 'No reason provided' });
  return embed;
}

function caseLine(doc) {
  const meta = TYPE_META[doc.type];
  return `**#${doc.caseId}** • ${meta.label} • ${ts(doc.createdAt)} • ${truncate(doc.reason, 70)}`;
}

async function sendLog(guild, logChannelId, payload) {
  if (!logChannelId) return;
  try {
    const channel = await guild.channels.fetch(logChannelId);
    if (channel && channel.isTextBased()) await channel.send({ ...payload, allowedMentions: { parse: [] } });
  } catch (err) {
    console.warn(`[LOG] Could not write to the log channel in ${guild.id}: ${err.message}`);
  }
}

async function createCase(ctx, { type, user, reason, duration = null }) {
  const cfg = await GuildConfig.findOneAndUpdate(
    { guildId: ctx.guild.id },
    { $inc: { caseCounter: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const doc = await Case.create({
    guildId: ctx.guild.id,
    caseId: cfg.caseCounter,
    type,
    userId: user.id,
    userTag: user.username,
    moderatorId: ctx.user.id,
    moderatorTag: ctx.user.username,
    reason,
    duration,
  });
  await sendLog(ctx.guild, cfg.logChannelId, { embeds: [caseEmbed(doc)] });
  return doc;
}

async function logEvent(ctx, title, description) {
  const embed = new EmbedBuilder()
    .setColor(colors.brand)
    .setTitle(title)
    .setDescription(truncate(description, 3500))
    .setFooter({ text: `${ctx.user.username} (${ctx.user.id})` })
    .setTimestamp();
  await sendLog(ctx.guild, ctx.config.logChannelId, { embeds: [embed] });
}

async function notifyUser(user, guild, title, reason, extra = '') {
  try {
    const embed = new EmbedBuilder()
      .setColor(colors.warn)
      .setTitle(title)
      .setDescription(`**Server:** ${guild.name}\n**Reason:** ${truncate(reason, 900)}${extra ? `\n${extra}` : ''}`)
      .setTimestamp();
    await user.send({ embeds: [embed] });
    return true;
  } catch {
    return false;
  }
}

module.exports = { TYPE_META, caseEmbed, caseLine, createCase, logEvent, notifyUser, sendLog };
