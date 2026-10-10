const embeds = require('../../utils/embeds');

module.exports = {
  name: 'ping',
  description: 'Check the bot latency.',
  category: 'Utility',
  level: 'helper',
  async run(ctx) {
    const created = ctx.interaction ? ctx.interaction.createdTimestamp : ctx.message.createdTimestamp;
    const response = Date.now() - created;
    return ctx.reply({
      embeds: [embeds.info(`🏓 Pong!\n**Response time:** ${response}ms\n**Gateway:** ${Math.round(ctx.client.ws.ping)}ms`)],
    });
  },
};
