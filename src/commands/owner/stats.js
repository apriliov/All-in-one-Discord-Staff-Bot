const { EmbedBuilder, version } = require('discord.js');
const mongoose = require('mongoose');
const { colors } = require('../../config');
const { formatDuration } = require('../../utils/duration');

module.exports = {
  name: 'stats',
  description: 'Show bot statistics.',
  category: 'Owner',
  level: 'owner',
  ephemeral: true,
  async run(ctx) {
    const memory = process.memoryUsage().rss / 1024 / 1024;
    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setTitle('Bot statistics')
      .addFields(
        { name: 'Uptime', value: formatDuration(process.uptime() * 1000), inline: true },
        { name: 'Gateway ping', value: `${Math.round(ctx.client.ws.ping)}ms`, inline: true },
        { name: 'Memory', value: `${memory.toFixed(1)} MB`, inline: true },
        { name: 'Servers', value: String(ctx.client.guilds.cache.size), inline: true },
        { name: 'Database', value: mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected', inline: true },
        { name: 'Versions', value: `Node ${process.versions.node} • discord.js ${version}`, inline: true }
      );
    return ctx.reply({ embeds: [embed] });
  },
};
