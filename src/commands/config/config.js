const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const { colors } = config;

module.exports = {
  name: 'config',
  description: 'Show the bot settings of this server.',
  category: 'Config',
  level: 'admin',
  ephemeral: true,
  async run(ctx) {
    const cfg = ctx.config;
    const list = (ids) => (ids.length ? ids.map((id) => `<@&${id}>`).join(' ') : 'None');
    const embed = new EmbedBuilder()
      .setColor(colors.brand)
      .setTitle('Server settings')
      .addFields(
        { name: 'Log channel', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'Not set (use `{prefix}setlog`)' },
        { name: 'Helper roles', value: list(cfg.helperRoleIds) },
        { name: 'Admin roles', value: list(cfg.adminRoleIds) },
        { name: 'Cases created', value: String(cfg.caseCounter), inline: true },
        { name: 'Prefix', value: config.prefixes.map((p) => `\`${p}\``).join(' or '), inline: true }
      )
      .setFooter({ text: 'Server owner and members with the Administrator permission always count as admins.' });
    return ctx.reply({ embeds: [embed] });
  },
};
