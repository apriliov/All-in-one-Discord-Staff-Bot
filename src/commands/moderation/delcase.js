const Case = require('../../database/models/Case');
const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'delcase',
  description: 'Delete a warning or note from the case log.',
  category: 'Moderation',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Case number (warns and notes only)', required: true, min: 1 }],
  async run(ctx, args) {
    const doc = await Case.findOne({ guildId: ctx.guild.id, caseId: args.id });
    if (!doc) return ctx.reply({ embeds: [embeds.error(`Case #${args.id} does not exist.`)] });
    if (!['warn', 'note'].includes(doc.type)) {
      return ctx.reply({ embeds: [embeds.error('Only warnings and notes can be deleted.')] });
    }
    await doc.deleteOne();
    await logEvent(ctx, 'Case deleted', `Case **#${doc.caseId}** (${doc.type}) for <@${doc.userId}> was deleted.`);
    return ctx.reply({ embeds: [embeds.success(`Deleted case **#${args.id}**.`)] });
  },
};
