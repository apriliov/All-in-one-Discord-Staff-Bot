const Snippet = require('../../database/models/Snippet');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'snippetset',
  description: 'Create or update a snippet.',
  category: 'Snippets',
  level: 'admin',
  ephemeral: true,
  options: [
    { name: 'name', type: 'string', description: 'Snippet name (letters, numbers, - and _)', required: true, maxLength: 32 },
    { name: 'content', type: 'string', description: 'Snippet text (use \\n for a new line)', required: true, maxLength: 1800 },
  ],
  async run(ctx, args) {
    const name = args.name.toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
      return ctx.reply({ embeds: [embeds.error('Snippet names may only contain letters, numbers, `-` and `_`.')] });
    }
    await Snippet.findOneAndUpdate(
      { guildId: ctx.guild.id, name },
      { content: args.content.replace(/\\n/g, '\n'), createdBy: ctx.user.id },
      { upsert: true, setDefaultsOnInsert: true }
    );
    return ctx.reply({ embeds: [embeds.success(`Snippet \`${name}\` saved.`)] });
  },
};
