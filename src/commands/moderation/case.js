const Case = require('../../database/models/Case');
const embeds = require('../../utils/embeds');
const { caseEmbed } = require('../../services/cases');

module.exports = {
  name: 'case',
  description: 'Show the details of one case.',
  category: 'Moderation',
  level: 'helper',
  options: [{ name: 'id', type: 'integer', description: 'Case number', required: true, min: 1 }],
  async run(ctx, args) {
    const doc = await Case.findOne({ guildId: ctx.guild.id, caseId: args.id }).lean();
    if (!doc) return ctx.reply({ embeds: [embeds.error(`Case #${args.id} does not exist.`)] });
    return ctx.reply({ embeds: [caseEmbed(doc)] });
  },
};
