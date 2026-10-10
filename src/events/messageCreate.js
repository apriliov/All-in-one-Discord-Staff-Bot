const { Events } = require('discord.js');
const config = require('../config');
const { Context } = require('../core/context');
const { dispatch } = require('../core/dispatch');
const { handleDirectMessage, forwardStaffMessage } = require('../services/modmail');
const { noteActivity } = require('../services/tickets');

module.exports = {
  name: Events.MessageCreate,
  async execute(client, message) {
    if (message.author.bot) return;

    if (!message.guild) {
      await handleDirectMessage(client, message).catch((err) => console.error('[MODMAIL] DM handler failed:', err));
      return;
    }

    if (!config.isAllowedGuild(message.guild.id)) return;

    const usedPrefix = message.content ? config.prefixes.find((p) => message.content.startsWith(p)) : null;
    if (usedPrefix) {
      const match = message.content.slice(usedPrefix.length).match(/^\s*(\S+)([\s\S]*)$/);
      const command = match ? client.registry.find(match[1].toLowerCase()) : null;
      if (command) {
        await dispatch(new Context(client, { message }), command, match[2].trimStart());
        return;
      }
    }

    noteActivity(message.channel.id);

    await forwardStaffMessage(client, message).catch((err) => console.error('[MODMAIL] Forward failed:', err));
  },
};
