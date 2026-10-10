const Snippet = require('../../database/models/Snippet');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'snippets',
  description: 'List all saved snippets.',
  category: 'Snippets',
  level: 'helper',
  ephemeral: true,
  async run(ctx) {
    const docs = await Snippet.find({ guildId: ctx.guild.id }).sort({ name: 1 }).lean();
    if (!docs.length) return ctx.reply({ embeds: [embeds.info('There are no snippets yet. Admins can add one with `{prefix}snippetset`.')] });
    return ctx.reply({ embeds: [embeds.info(`**Snippets (${docs.length})**\n${docs.map((d) => `\`${d.name}\``).join(' ')}`)] });
  },
};
