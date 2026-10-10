const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');

const LEVELS = { none: 0, helper: 1, admin: 2, owner: 3 };
const LEVEL_NAMES = ['None', 'Helper', 'Admin', 'Owner'];

function getLevel(member, cfg) {
  if (config.ownerIds.has(member.id)) return LEVELS.owner;
  const hasRole = (ids) => (ids || []).some((id) => member.roles.cache.has(id));
  if (
    member.id === member.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    hasRole(cfg.adminRoleIds)
  ) {
    return LEVELS.admin;
  }
  if (hasRole(cfg.helperRoleIds)) return LEVELS.helper;
  return LEVELS.none;
}

function canPostIn(ctx, channel) {
  if (!channel || typeof channel.isTextBased !== 'function' || !channel.isTextBased() || channel.isDMBased()) {
    return 'That is not a text channel I can post in.';
  }
  const needed = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
  const me = ctx.guild.members.me;
  if (!channel.permissionsFor(me)?.has(needed)) {
    return 'I do not have permission to send messages in that channel.';
  }

  if (ctx.level < LEVELS.owner && !channel.permissionsFor(ctx.member)?.has(needed)) {
    return 'You do not have permission to send messages in that channel.';
  }
  return null;
}

module.exports = { LEVELS, LEVEL_NAMES, getLevel, canPostIn };
