const { EmbedBuilder } = require('discord.js');
const Case = require('../../database/models/Case');
const { colors } = require('../../config');
const { ts, truncate } = require('../../utils/format');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'notes',
  description: 'Show the staff notes of a user.',
  category: 'Moderation',
  level: 'helper',
  ephemeral: true,
  options: [{ name: 'user', type: 'user', description: 'User to check', required: true }],
  async run(ctx, args) {
    const filter = { guildId: ctx.guild.id, userId: args.user.id, type: 'note' };
    const docs = await Case.find(filter).sort({ caseId: -1 }).limit(15).lean();
    if (!docs.length) return ctx.reply({ embeds: [embeds.info(`<@${args.user.id}> has no notes.`)] });

    const lines = docs.map((d) => `**#${d.caseId}** • <@${d.moderatorId}> • ${ts(d.createdAt)}\n${truncate(d.reason, 200)}`);
    const embed = new EmbedBuilder()
      .setColor(colors.neutral)
      .setTitle(`Notes for ${args.user.username}`)
      .setDescription(lines.join('\n\n'));
    return ctx.reply({ embeds: [embed] });
  },
};
