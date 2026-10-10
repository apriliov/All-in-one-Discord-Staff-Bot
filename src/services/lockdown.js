const { ChannelType } = require('discord.js');
const ChannelLock = require('../database/models/ChannelLock');
const config = require('../config');
const { lockChannel, unlockChannel } = require('./lock');
const { isTicketChannel } = require('./tickets');

const TEXT_TYPES = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildMedia].filter((t) => t !== undefined));
const VOICE_TYPES = new Set([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);

const isLockable = (c) => !!c && (TEXT_TYPES.has(c.type) || VOICE_TYPES.has(c.type)) && (!config.modmail.categoryId || c.parentId !== config.modmail.categoryId) && !isTicketChannel(c.id);
const isVoice = (c) => VOICE_TYPES.has(c.type);

async function pool(items, size, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

const lockdownCount = (guildId) => ChannelLock.countDocuments({ guildId, lockdown: true });
const isLockdownActive = async (guildId) => !!(await ChannelLock.exists({ guildId, lockdown: true }));

async function startLockdown(ctx) {
  const all = await ctx.guild.channels.fetch();
  const targets = [...all.values()].filter(isLockable);
  const result = { total: targets.length, text: 0, voice: 0, already: 0, failed: [] };

  await pool(targets, 4, async (channel) => {
    try {
      const res = await lockChannel(ctx, channel, { lockdown: true });
      if (res.error) result.already++;
      else if (isVoice(channel)) result.voice++;
      else result.text++;
    } catch (err) {
      console.warn(`[LOCKDOWN] Could not lock #${channel.name}:`, err.message);
      result.failed.push(channel.name);
    }
  });
  return result;
}

async function endLockdown(ctx) {
  const docs = await ChannelLock.find({ guildId: ctx.guild.id, lockdown: true }).lean();
  const result = { total: docs.length, unlocked: 0, gone: 0, failed: 0 };

  await pool(docs, 4, async (doc) => {
    const channel = ctx.guild.channels.cache.get(doc.channelId) || (await ctx.guild.channels.fetch(doc.channelId).catch(() => null));
    if (!channel) {
      await ChannelLock.deleteOne({ _id: doc._id });
      result.gone++;
      return;
    }
    try {
      const res = await unlockChannel(ctx, channel);
      if (res.error || res.failed) result.failed++;
      else result.unlocked++;
    } catch (err) {
      console.warn(`[LOCKDOWN] Could not unlock #${channel.name}:`, err.message);
      result.failed++;
    }
  });
  return result;
}

module.exports = { isLockable, isVoice, startLockdown, endLockdown, lockdownCount, isLockdownActive };
