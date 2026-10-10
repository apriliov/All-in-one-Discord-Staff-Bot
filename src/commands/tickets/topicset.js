const { ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const { refreshPanel } = require('../../services/tickets');
const { getPanel, findTopic, parseQuestions } = require('../../services/ticketAdmin');
const { roleId, channelId, isNone, emojiObject } = require('../../utils/parse');
const { logEvent } = require('../../services/cases');

const FIELDS = ['label', 'emoji', 'description', 'color', 'category', 'role', 'welcome', 'name', 'questions'];
const COLORS = ['blurple', 'grey', 'green', 'red'];

module.exports = {
  name: 'topicset',
  description: 'Edit a topic: label, emoji, description, color, category, role, welcome, name, questions.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'panel', type: 'integer', description: 'Panel number', required: true, min: 1 },
    { name: 'topic', type: 'string', description: 'Topic key (see panellist)', required: true, maxLength: 40 },
    { name: 'field', type: 'string', description: 'What to change', required: true, choices: FIELDS },
    { name: 'value', type: 'string', description: 'New value. "none" clears it. Questions: Q1 | Q2 [long] | Q3 [optional]', required: true, maxLength: 1500 },
  ],
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.panel);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.panel} was not found.`)] });
    const topic = findTopic(panel, args.topic);
    if (!topic) return ctx.reply({ embeds: [embeds.error('Topic not found. Check the keys with `{prefix}panellist <panel>`.')] });

    const value = args.value.trim();
    const clear = isNone(value);
    let summary;

    switch (args.field) {
      case 'label':
        topic.label = value.slice(0, 80);
        summary = `Label is now **${topic.label}**.`;
        break;
      case 'emoji':
        if (clear) topic.emoji = null;
        else if (!emojiObject(value)) return ctx.reply({ embeds: [embeds.error('Use a normal emoji or a custom emoji from this server, or `none`.')] });
        else topic.emoji = value;
        summary = clear ? 'Emoji removed.' : `Emoji is now ${value}.`;
        break;
      case 'description':
        topic.description = clear ? null : value.slice(0, 100);
        summary = clear ? 'Description removed.' : 'Description updated (shown in menu style).';
        break;
      case 'color': {
        const color = value.toLowerCase();
        if (!COLORS.includes(color)) return ctx.reply({ embeds: [embeds.error(`Button color must be one of: ${COLORS.join(', ')}.`)] });
        topic.style = color;
        summary = `Button color is now **${color}**.`;
        break;
      }
      case 'category': {
        if (clear) {
          topic.categoryId = null;
          summary = 'Category cleared. The default ticket category is used.';
          break;
        }
        const id = channelId(value);
        const channel = id ? await ctx.guild.channels.fetch(id).catch(() => null) : null;
        if (!channel || channel.type !== ChannelType.GuildCategory) return ctx.reply({ embeds: [embeds.error('Give me a **category** ID.')] });
        topic.categoryId = channel.id;
        summary = `Tickets of this topic are created in **${channel.name}**.`;
        break;
      }
      case 'role': {
        if (clear) {
          topic.supportRoleIds = [];
          summary = 'Support roles cleared. The default support roles are used.';
          break;
        }
        const id = roleId(value);
        const role = id ? await ctx.guild.roles.fetch(id).catch(() => null) : null;
        if (!role) return ctx.reply({ embeds: [embeds.error('I could not find that role. Use a mention or a role ID, or `none`.')] });
        if (topic.supportRoleIds.includes(role.id)) {
          topic.supportRoleIds = topic.supportRoleIds.filter((r) => r !== role.id);
          summary = `${role} is no longer a support role for this topic.`;
        } else {
          topic.supportRoleIds = [...topic.supportRoleIds, role.id];
          summary = `${role} is now a support role for this topic.`;
        }
        break;
      }
      case 'welcome':
        topic.welcome = clear ? null : value.replace(/\\n/g, '\n').slice(0, 1500);
        summary = clear ? 'Welcome message reset to the default.' : 'Welcome message updated. Variables: `{user}` `{username}` `{topic}` `{server}` `{number}`.';
        break;
      case 'name':
        if (clear) topic.namePattern = null;
        else if (!/\{number\}/i.test(value)) return ctx.reply({ embeds: [embeds.error('The pattern must contain `{number}`. Example: `billing-{number}`')] });
        else topic.namePattern = value.slice(0, 60);
        summary = clear ? 'Channel name pattern reset to the default.' : `Channel names now look like \`${value.slice(0, 60)}\`.`;
        break;
      case 'questions': {
        if (clear) {
          topic.questions = [];
          summary = 'Questions removed. Tickets open without a form.';
          break;
        }
        const questions = parseQuestions(value);
        if (!questions.length) return ctx.reply({ embeds: [embeds.error('Give at least one question. Example: `What is your issue? [long] | Your username [optional]`')] });
        topic.questions = questions;
        summary = `${questions.length} question(s) saved. Users fill them in before the ticket opens (max 5).`;
        break;
      }
      default:
        return ctx.reply({ embeds: [embeds.error(`Unknown field. Choose one of: ${FIELDS.join(', ')}.`)] });
    }

    await panel.save();
    const result = await refreshPanel(ctx.guild, panel).catch((err) => ({ ok: false, reason: err.message }));
    await logEvent(ctx, 'Ticket topic edited', `Panel #${panel.panelId}, topic \`${topic.key}\`: changed **${args.field}**.`);
    return ctx.reply({ embeds: [embeds.success(`${summary}${result.ok ? '' : `\n⚠️ The panel message was not updated: ${result.reason}`}`)] });
  },
};
