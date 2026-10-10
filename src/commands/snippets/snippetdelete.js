const Snippet = require('../../database/models/Snippet');
const embeds = require('../../utils/embeds');
const { autocompleteSnippets } = require('../../services/snippets');

module.exports = {
  name: 'snippetdelete',
  aliases: ['snippetremove'],
  description: 'Delete a snippet.',
  category: 'Snippets',
  level: 'admin',
  ephemeral: true,
  options: [{ name: 'name', type: 'string', description: 'Snippet name', required: true, maxLength: 32, autocomplete: true }],
  autocomplete: autocompleteSnippets,
  async run(ctx, args) {
    const res = await Snippet.deleteOne({ guildId: ctx.guild.id, name: args.name.toLowerCase() });
    if (!res.deletedCount) return ctx.reply({ embeds: [embeds.error('That snippet does not exist.')] });
    return ctx.reply({ embeds: [embeds.success(`Snippet \`${args.name.toLowerCase()}\` deleted.`)] });
  },
};
