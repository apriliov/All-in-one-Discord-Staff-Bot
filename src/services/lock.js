const { OverwriteType } = require('discord.js');
const ChannelLock = require('../database/models/ChannelLock');
const { auditReason } = require('./moderation');

const TEXT_KIND = {
  lock: ['SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads', 'AddReactions'],

  staff: ['SendMessages', 'SendMessagesInThreads'],
  gate: 'SendMessages',
};
const VOICE_KIND = {
  lock: ['Connect', 'Speak', 'Stream', 'SendMessages', 'AddReactions'],
  staff: ['Connect', 'Speak', 'SendMessages'],
  gate: 'Connect',
};
const LOCK_PERMS = TEXT_KIND.lock;

const kindOf = (channel) => (typeof channel.isVoiceBased === 'function' && channel.isVoiceBased() ? VOICE_KIND : TEXT_KIND);

const stateOf = (overwrite, perm) => (!overwrite ? null : overwrite.allow.has(perm) ? true : overwrite.deny.has(perm) ? false : null);
const valuesFor = (perms, value) => Object.fromEntries(perms.map((p) => [p, value]));

async function planLock(ctx, channel) {
  const kind = kindOf(channel);
  const guild = ctx.guild;
  const me = guild.members.me || (await guild.members.fetchMe());
  const cache = channel.permissionOverwrites.cache;
  const staffRoleIds = new Set([...(ctx.config.helperRoleIds || []), ...(ctx.config.adminRoleIds || [])].filter((id) => guild.roles.cache.has(id)));
  const plan = new Map();

  plan.set(guild.id, { type: OverwriteType.Role, values: valuesFor(kind.lock, false) });

  for (const ow of cache.values()) {
    if (ow.type !== OverwriteType.Role || ow.id === guild.id || staffRoleIds.has(ow.id)) continue;
    if (kind.lock.some((p) => ow.allow.has(p))) plan.set(ow.id, { type: OverwriteType.Role, values: valuesFor(kind.lock, false) });
  }

  for (const roleId of staffRoleIds) {
    const role = guild.roles.cache.get(roleId);
    if (role && channel.permissionsFor(role)?.has(kind.gate)) {
      plan.set(roleId, { type: OverwriteType.Role, values: valuesFor(kind.staff, true) });
    }
  }
  if (channel.permissionsFor(me)?.has(kind.gate)) {
    plan.set(me.id, { type: OverwriteType.Member, values: valuesFor(kind.staff, true) });
  }

  return [...plan.entries()].map(([id, { type, values }]) => {
    const current = cache.get(id);
    return {
      id,
      type,
      values,
      existed: !!current,
      before: Object.keys(values).map((perm) => ({ perm, state: stateOf(current, perm) })),
    };
  });
}

async function restore(channel, entries, reason) {
  let failed = 0;
  for (const e of entries) {
    const values = Object.fromEntries(e.before.map((b) => [b.perm, b.state === undefined ? null : b.state]));
    try {
      await channel.permissionOverwrites.edit(e.id, values, { type: e.type, reason });
      if (!e.existed) await channel.permissionOverwrites.delete(e.id, reason).catch(() => {});
    } catch {
      failed++;
    }
  }
  return failed;
}

async function lockChannel(ctx, channel, { lockdown = false } = {}) {
  if (channel.isThread && channel.isThread()) {
    if (channel.locked) return { error: 'That thread is already locked.' };
    await channel.setLocked(true, auditReason(ctx, 'Thread locked'));
    return { mode: 'thread' };
  }
  if (!channel.permissionOverwrites) return { error: 'That channel cannot be locked.' };
  if (await ChannelLock.exists({ guildId: ctx.guild.id, channelId: channel.id })) {
    return { error: 'That channel is already locked. Use `unlock` first.' };
  }

  const plan = await planLock(ctx, channel);
  const reason = auditReason(ctx, lockdown ? 'Server lockdown' : 'Channel locked');

  await ChannelLock.create({
    guildId: ctx.guild.id,
    channelId: channel.id,
    lockedBy: ctx.user.id,
    lockdown,
    entries: plan.map(({ id, type, existed, before }) => ({ id, type, existed, before })),
  });

  const ordered = [...plan].sort((a, b) => Number(Object.values(b.values)[0]) - Number(Object.values(a.values)[0]));
  try {
    for (const p of ordered) await channel.permissionOverwrites.edit(p.id, p.values, { type: p.type, reason });
  } catch (err) {
    await restore(channel, plan, auditReason(ctx, 'Lock failed, restoring')).catch(() => {});
    await ChannelLock.deleteOne({ guildId: ctx.guild.id, channelId: channel.id });
    throw err;
  }
  return { mode: 'channel', changed: plan.length };
}

async function unlockChannel(ctx, channel) {
  if (channel.isThread && channel.isThread()) {
    if (!channel.locked) return { error: 'That thread is not locked.' };
    await channel.setLocked(false, auditReason(ctx, 'Thread unlocked'));
    return { mode: 'thread' };
  }
  if (!channel.permissionOverwrites) return { error: 'That channel cannot be unlocked.' };

  const doc = await ChannelLock.findOne({ guildId: ctx.guild.id, channelId: channel.id }).lean();
  const reason = auditReason(ctx, doc && doc.lockdown ? 'Lockdown lifted' : 'Channel unlocked');
  if (!doc) {
    await channel.permissionOverwrites.edit(ctx.guild.roles.everyone, { SendMessages: null }, { type: OverwriteType.Role, reason });
    return { mode: 'legacy', failed: 0 };
  }
  const failed = await restore(channel, doc.entries, reason);
  if (!failed) await ChannelLock.deleteOne({ _id: doc._id });
  return { mode: 'channel', failed };
}

module.exports = { lockChannel, unlockChannel, LOCK_PERMS };
