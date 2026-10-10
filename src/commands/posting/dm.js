const { EmbedBuilder } = require('discord.js');
const embeds = require('../../utils/embeds');
const { colors } = require('../../config');
const { logEvent } = require('../../services/cases');
const { truncate } = require('../../utils/format');

module.exports = {
  name: 'dm',
  description: 'Send a direct message to one member as the server staff.',
  category: 'Posting',
  level: 'admin',
  ephemeral: true,
  options: [
    { name: 'user', type: 'user', description: 'Member to message', required: true },
    { name: 'message', type: 'string', description: 'Message text (use \\n for a new line)', required: true, maxLength: 1800 },
  ],
  async run(ctx, args) {
    if (args.user.bot) return ctx.reply({ embeds: [embeds.error('You cannot DM a bot.')] });

    const text = args.message.replace(/\\n/g, '\n');
    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setTitle(`Message from the staff of ${ctx.guild.name}`)
      .setDescription(text)
      .setTimestamp();
    try {
      await args.user.send({ embeds: [embed] });
    } catch {
      return ctx.reply({ embeds: [embeds.error('I could not DM that user (their DMs are closed).')] });
    }
    await logEvent(ctx, 'Staff DM sent', `Sent to <@${args.user.id}>:\n${truncate(text, 500)}`);
    return ctx.reply({ embeds: [embeds.success(`Sent a DM to <@${args.user.id}>.`)] });
  },
};
