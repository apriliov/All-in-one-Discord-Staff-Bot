const { ChannelType } = require('discord.js');
const GuildConfig = require('../../database/models/GuildConfig');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'setlog',
  description: 'Set the channel for staff logs. Leave empty to turn logging off.',
  category: 'Config',
  level: 'admin',
  ephemeral: true,
  options: [{ name: 'channel', type: 'channel', description: 'Log channel', channelTypes: [ChannelType.GuildText] }],
  async run(ctx, args) {
    await GuildConfig.updateOne({ guildId: ctx.guild.id }, { logChannelId: args.channel ? args.channel.id : null }, { upsert: true });
    return ctx.reply({
      embeds: [embeds.success(args.channel ? `Logs will be sent to <#${args.channel.id}>.` : 'Logging turned off.')],
    });
  },
};
