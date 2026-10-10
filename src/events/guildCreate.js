const { Events } = require('discord.js');
const config = require('../config');

module.exports = {
  name: Events.GuildCreate,
  async execute(client, guild) {
    if (!config.isAllowedGuild(guild.id)) {
      console.log(`[BOT] Joined a server that is not on the list ${guild.name} (${guild.id}) - leaving.`);
      await guild.leave().catch(() => {});
    }
  },
};
