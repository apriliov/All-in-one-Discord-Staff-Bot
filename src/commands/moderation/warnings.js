const { EmbedBuilder } = require('discord.js');
const Case = require('../../database/models/Case');
const { colors } = require('../../config');
const { caseLine } = require('../../services/cases');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'warnings',
  aliases: ['warns'],
  description: 'Show the warnings of a user.',
  category: 'Moderation',
  level: 'helper',
  options: [{ name: 'user', type: 'user', description: 'User to check', required: true }],
  async run(ctx, args) {
    const filter = { guildId: ctx.guild.id, userId: args.user.id, type: 'warn' };
    const [total, docs] = await Promise.all([
      Case.countDocuments(filter),
      Case.find(filter).sort({ caseId: -1 }).limit(15).lean(),
    ]);
    if (!total) return ctx.reply({ embeds: [embeds.info(`<@${args.user.id}> has no warnings.`)] });

    const embed = new EmbedBuilder()
      .setColor(colors.warn)
      .setTitle(`Warnings for ${args.user.username}`)
      .setDescription(docs.map(caseLine).join('\n'))
      .setFooter({ text: `${total} warning(s) total${total > 15 ? ' • showing the latest 15' : ''}` });
    return ctx.reply({ embeds: [embed] });
  },
};
