const { Events } = require('discord.js');
const { isTracked, scheduleRefresh } = require('../services/statusPage');

module.exports = {
  name: Events.PresenceUpdate,
  async execute(client, oldPresence, newPresence) {
    if (!newPresence || !isTracked(newPresence.userId)) return;
    scheduleRefresh(client);
  },
};
