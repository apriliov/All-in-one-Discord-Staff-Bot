const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config');

module.exports = {
  name: 'avatar',
  aliases: ['av'],
  description: "Show a user's avatar.",
  category: 'Utility',
  level: 'helper',
  options: [{ name: 'user', type: 'user', description: 'User (default: you)' }],
  async run(ctx, args) {
    const user = args.user || ctx.user;
    const url = user.displayAvatarURL({ size: 1024 });
    const embed = new EmbedBuilder().setColor(colors.brand).setTitle(`${user.username}'s avatar`).setURL(url).setImage(url);
    return ctx.reply({ embeds: [embed] });
  },
};
