const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const embeds = require('../../utils/embeds');
const TicketPanel = require('../../database/models/TicketPanel');
const { getPanel, describeTopic } = require('../../services/ticketAdmin');
const { truncate } = require('../../utils/format');

module.exports = {
  name: 'panellist',
  aliases: ['panels', 'panelinfo'],
  description: 'List the ticket panels, or show one panel with its topics.',
  category: 'Tickets',
  level: 'admin',
  options: [{ name: 'id', type: 'integer', description: 'Panel number for details', min: 1 }],
  async run(ctx, args) {
    if (args.id) {
      const panel = await getPanel(ctx.guild.id, args.id);
      if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.id} was not found.`)] });
      const embed = new EmbedBuilder()
        .setColor(config.colors.brand)
        .setTitle(`Panel #${panel.panelId}: ${truncate(panel.title, 200)}`)
        .setDescription(truncate(panel.description, 500))
        .addFields(
          { name: 'Channel', value: panel.channelId ? `<#${panel.channelId}>` : 'Unknown', inline: true },
          { name: 'Style', value: panel.style, inline: true },
          { name: 'Topics', value: truncate(panel.topics.map(describeTopic).join('\n') || 'None', 1000) }
        );
      return ctx.reply({ embeds: [embed] });
    }

    const panels = await TicketPanel.find({ guildId: ctx.guild.id }).sort({ panelId: 1 }).lean();
    if (!panels.length) return ctx.reply({ embeds: [embeds.info('No panels yet. Create one with `{prefix}panelcreate #channel`.')] });
    const lines = panels.map((p) => `**#${p.panelId}** • ${truncate(p.title, 40)} • ${p.channelId ? `<#${p.channelId}>` : 'no channel'} • ${p.style} • ${p.topics.length} topic(s)`);
    return ctx.reply({ embeds: [new EmbedBuilder().setColor(config.colors.brand).setTitle('Ticket panels').setDescription(truncate(lines.join('\n'), 4000)).setFooter({ text: 'Details: {prefix}panellist <id>' })] });
  },
};
