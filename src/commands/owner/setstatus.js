const GuildConfig = require('../../database/models/GuildConfig');
const embeds = require('../../utils/embeds');
const { getMainGuild } = require('../../services/mainGuild');
const { refreshPresence } = require('../../services/status');

module.exports = {
  name: 'setstatus',
  description: 'Set the custom part of the bot status. Empty resets it.',
  category: 'Owner',
  level: 'owner',
  ephemeral: true,
  options: [{ name: 'text', type: 'string', description: 'Status text (Modmail Open/Close is added automatically)', maxLength: 80 }],
  async run(ctx, args) {
    const guild = getMainGuild(ctx.client) || ctx.guild;
    await GuildConfig.updateOne({ guildId: guild.id }, { statusText: args.text || null }, { upsert: true });
    const status = await refreshPresence(ctx.client);
    return ctx.reply({ embeds: [embeds.success(`Status is now **${status}**.`)] });
  },
};
