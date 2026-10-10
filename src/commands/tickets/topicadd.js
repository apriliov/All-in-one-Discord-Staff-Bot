const embeds = require('../../utils/embeds');
const { refreshPanel } = require('../../services/tickets');
const { getPanel } = require('../../services/ticketAdmin');
const { slug } = require('../../utils/parse');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'topicadd',
  description: 'Add a topic (button or menu entry) to a ticket panel.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'panel', type: 'integer', description: 'Panel number', required: true, min: 1 },
    { name: 'label', type: 'string', description: 'Topic name, e.g. Billing', required: true, maxLength: 80 },
  ],
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.panel);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.panel} was not found.`)] });
    if (panel.topics.length >= 25) return ctx.reply({ embeds: [embeds.error('A panel can have at most 25 topics.')] });

    const label = args.label.trim();
    const base = slug(label, 20) || 'topic';
    let key = base;
    for (let i = 2; panel.topics.some((t) => t.key === key); i++) key = `${base}-${i}`.slice(0, 24);

    panel.topics.push({ key, label });
    await panel.save();
    const result = await refreshPanel(ctx.guild, panel).catch((err) => ({ ok: false, reason: err.message }));
    await logEvent(ctx, 'Ticket topic added', `Panel #${panel.panelId}: **${label}** (\`${key}\`)`);
    return ctx.reply({
      embeds: [
        embeds.success(
          `Topic **${label}** (\`${key}\`) added to panel #${panel.panelId}.${result.ok ? '' : `\n⚠️ The panel message was not updated: ${result.reason}`}\nCustomize it with \`{prefix}topicset ${panel.panelId} ${key} <field> <value>\`.`
        ),
      ],
    });
  },
};
