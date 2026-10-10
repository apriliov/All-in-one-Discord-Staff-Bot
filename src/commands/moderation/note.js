const embeds = require('../../utils/embeds');
const { createCase } = require('../../services/cases');

module.exports = {
  name: 'note',
  description: 'Add a private staff note to a user (the user is not notified).',
  category: 'Moderation',
  level: 'helper',
  options: [
    { name: 'user', type: 'user', description: 'User the note is about', required: true },
    { name: 'text', type: 'string', description: 'The note', required: true, maxLength: 500 },
  ],
  async run(ctx, args) {
    const doc = await createCase(ctx, { type: 'note', user: args.user, reason: args.text });
    return ctx.reply({ embeds: [embeds.success(`Note added to <@${args.user.id}> (case **#${doc.caseId}**).`)] });
  },
};
