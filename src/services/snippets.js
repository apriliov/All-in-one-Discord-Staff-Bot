const Snippet = require('../database/models/Snippet');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function autocompleteSnippets(interaction) {
  const typed = escapeRegex(interaction.options.getFocused().toLowerCase().trim());
  const docs = await Snippet.find({ guildId: interaction.guildId, name: new RegExp(`^${typed}`) }).sort({ name: 1 }).limit(25).lean();
  return interaction.respond(docs.map((d) => ({ name: d.name, value: d.name })));
}

module.exports = { autocompleteSnippets };
