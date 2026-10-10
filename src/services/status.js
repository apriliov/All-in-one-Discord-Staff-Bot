const { ActivityType } = require('discord.js');
const config = require('../config');
const { getMainGuild } = require('./mainGuild');
const { getGuildConfig } = require('./guildConfig');

function buildStatus(cfg) {
  const base = (cfg && cfg.statusText) || config.defaultStatus;
  const suffix = cfg && cfg.modmailOpen === false ? 'Modmail Close' : 'Modmail Open';
  return `${base.slice(0, 100)} | ${suffix}`;
}

async function refreshPresence(client) {
  const guild = getMainGuild(client);
  const cfg = guild ? await getGuildConfig(guild.id) : null;
  const text = buildStatus(cfg);
  client.user.setPresence({ activities: [{ name: text, type: ActivityType.Playing }], status: 'online' });
  return text;
}

module.exports = { buildStatus, refreshPresence };
