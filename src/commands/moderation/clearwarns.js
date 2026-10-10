const Case = require('../../database/models/Case');
const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'clearwarns',
  aliases: ['clearwarnings'],
  description: 'Delete all warnings of a user (notes and other cases stay).',
  category: 'Moderation',
  level: 'admin',
  options: [{ name: 'user', type: 'user', description: 'User to clear', required: true }],
  async run(ctx, args) {
    const res = await Case.deleteMany({ guildId: ctx.guild.id, userId: args.user.id, type: 'warn' });
    if (!res.deletedCount) return ctx.reply({ embeds: [embeds.error(`<@${args.user.id}> has no warnings.`)] });
    await logEvent(ctx, 'Warnings cleared', `**${res.deletedCount}** warning(s) of <@${args.user.id}> were deleted.`);
    return ctx.reply({ embeds: [embeds.success(`Deleted **${res.deletedCount}** warning(s) of <@${args.user.id}>.`)] });
  },
};
