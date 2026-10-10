const config = require('../config');

function getMainGuild(client) {
  const id = config.guildId || [...config.allowedGuildIds][0];
  if (id) return client.guilds.cache.get(id) || null;
  return client.guilds.cache.first() || null;
}

module.exports = { getMainGuild };
