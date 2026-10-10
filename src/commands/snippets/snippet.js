const Snippet = require('../../database/models/Snippet');
const embeds = require('../../utils/embeds');
const { autocompleteSnippets } = require('../../services/snippets');

module.exports = {
  name: 'snippet',
  aliases: ['s', 'tag'],
  description: 'Send a saved snippet (canned reply), optionally pinging a user.',
  category: 'Snippets',
  level: 'helper',
  options: [
    { name: 'name', type: 'string', description: 'Snippet name', required: true, maxLength: 32, autocomplete: true },
    { name: 'user', type: 'user', description: 'User to address the snippet to' },
  ],
  autocomplete: autocompleteSnippets,
  async run(ctx, args) {
    const doc = await Snippet.findOne({ guildId: ctx.guild.id, name: args.name.toLowerCase() }).lean();
    if (!doc) return ctx.reply({ embeds: [embeds.error(`No snippet named \`${args.name}\`. Use \`{prefix}snippets\` to see the list.`)] });

    const payload = {
      content: args.user ? `<@${args.user.id}>` : undefined,
      embeds: [embeds.info(doc.content)],
      allowedMentions: { parse: [], users: args.user ? [args.user.id] : [] },
    };

    if (ctx.message) {
      await ctx.message.delete().catch(() => {});
      return ctx.send(payload);
    }
    return ctx.reply(payload);
  },
};
