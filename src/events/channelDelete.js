const { Events } = require('discord.js');
const Ticket = require('../database/models/Ticket');
const SupportTicket = require('../database/models/SupportTicket');
const ChannelLock = require('../database/models/ChannelLock');
const { removePagesByChannel } = require('../services/statusPage');

module.exports = {
  name: Events.ChannelDelete,
  async execute(client, channel) {
    if (!channel.guild) return;
    await Ticket.updateOne(
      { guildId: channel.guild.id, channelId: channel.id, status: 'open' },
      { status: 'closed', closedAt: new Date(), closeReason: 'Channel deleted' }
    ).catch((err) => console.warn('[MODMAIL] Could not close ticket of deleted channel:', err.message));
    await SupportTicket.updateOne(
      { guildId: channel.guild.id, channelId: channel.id, status: 'open' },
      { status: 'closed', closedAt: new Date(), closeReason: 'Channel deleted' }
    ).catch((err) => console.warn('[TICKETS] Could not close ticket of deleted channel:', err.message));
    await ChannelLock.deleteOne({ guildId: channel.guild.id, channelId: channel.id }).catch(() => {});
    await removePagesByChannel(channel.id).catch(() => {});
  },
};
