const { Events } = require('discord.js');
const { removePageByMessage } = require('../services/statusPage');

module.exports = {
  name: Events.MessageDelete,
  async execute(client, message) {
    await removePageByMessage(message.id).catch(() => {});
  },
};
