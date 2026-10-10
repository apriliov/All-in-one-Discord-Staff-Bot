const { Events } = require('discord.js');
const { getGuildConfig } = require('../services/guildConfig');
const { isLockable, isLockdownActive } = require('../services/lockdown');
const { lockChannel } = require('../services/lock');

module.exports = {
  name: Events.ChannelCreate,
  async execute(client, channel) {
    if (!channel.guild || !isLockable(channel)) return;
    try {
      if (!(await isLockdownActive(channel.guild.id))) return;
      const ctx = { guild: channel.guild, user: client.user, config: await getGuildConfig(channel.guild.id) };
      await lockChannel(ctx, channel, { lockdown: true });
    } catch (err) {
      console.warn('[LOCKDOWN] Could not lock the new channel:', err.message);
    }
  },
};
