const embeds = require('../../utils/embeds');
const { refreshPanel } = require('../../services/tickets');
const { getPanel, findTopic } = require('../../services/ticketAdmin');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'topicremove',
  description: 'Remove a topic from a ticket panel.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'panel', type: 'integer', description: 'Panel number', required: true, min: 1 },
    { name: 'topic', type: 'string', description: 'Topic key (see panellist)', required: true, maxLength: 40 },
  ],
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.panel);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.panel} was not found.`)] });
    const topic = findTopic(panel, args.topic);
    if (!topic) return ctx.reply({ embeds: [embeds.error('Topic not found. Check the keys with `{prefix}panellist <panel>`.')] });
    if (panel.topics.length <= 1) return ctx.reply({ embeds: [embeds.error('A panel needs at least one topic. Add another one first, or delete the panel.')] });

    panel.topics = panel.topics.filter((t) => t.key !== topic.key);
    await panel.save();
    const result = await refreshPanel(ctx.guild, panel).catch((err) => ({ ok: false, reason: err.message }));
    await logEvent(ctx, 'Ticket topic removed', `Panel #${panel.panelId}: **${topic.label}**`);
    return ctx.reply({ embeds: [embeds.success(`Topic **${topic.label}** removed.${result.ok ? '' : `\n⚠️ The panel message was not updated: ${result.reason}`}`)] });
  },
};
