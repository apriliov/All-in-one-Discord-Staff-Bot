const TicketPanel = require('../database/models/TicketPanel');
const { truncate } = require('../utils/format');

const getPanel = (guildId, panelId) => TicketPanel.findOne({ guildId, panelId });

function findTopic(panel, token) {
  const needle = String(token || '').trim().toLowerCase();
  return panel.topics.find((t) => t.key === needle) || panel.topics.find((t) => t.label.toLowerCase() === needle) || null;
}

function parseQuestions(value) {
  return String(value)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((raw) => ({
      label: raw.replace(/\[(long|optional)\]/gi, '').trim().slice(0, 45),
      long: /\[long\]/i.test(raw),
      required: !/\[optional\]/i.test(raw),
    }))
    .filter((q) => q.label);
}

function describeTopic(t) {
  const bits = [`\`${t.key}\` ${t.emoji ? `${t.emoji} ` : ''}**${truncate(t.label, 60)}**`];
  if (t.categoryId) bits.push(`category <#${t.categoryId}>`);
  if (t.supportRoleIds.length) bits.push(`roles ${t.supportRoleIds.map((id) => `<@&${id}>`).join(' ')}`);
  if (t.questions.length) bits.push(`${t.questions.length} question(s)`);
  return bits.join(' • ');
}

module.exports = { getPanel, findTopic, parseQuestions, describeTopic };
