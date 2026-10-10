const { ChannelType } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const TicketPanel = require('../../database/models/TicketPanel');
const { refreshPanel, postPanel } = require('../../services/tickets');
const { getPanel } = require('../../services/ticketAdmin');
const { channelId, isNone } = require('../../utils/parse');
const { logEvent } = require('../../services/cases');
const { fieldSubcommands } = require('../../utils/subcommands');

const FIELDS = ['title', 'description', 'color', 'image', 'footer', 'style', 'channel'];
const HINTS = {
  title: { about: 'Change the panel title.', value: 'New title.', max: 200 },
  description: { about: 'Change the panel description.', value: 'New description. Use \\n for a new line.', max: 2000 },
  color: { about: 'Change the panel embed color.', value: 'Hex color like #5865F2, or "none".', max: 20 },
  image: { about: 'Change the panel image.', value: 'Image URL (http/https), or "none" to remove it.', max: 500 },
  footer: { about: 'Change the panel footer.', value: 'Footer text, or "none" to remove it.', max: 200 },
  style: { about: 'Switch between buttons and a dropdown menu.', value: 'button or menu', max: 10, choices: ['button', 'menu'] },
  channel: { about: 'Move the panel to another channel.', value: 'Text channel mention or ID.', max: 100 },
};

module.exports = {
  name: 'paneledit',
  description: 'Edit a ticket panel: title, description, color, image, footer, style, channel.',
  category: 'Tickets',
  level: 'admin',
  options: [
    { name: 'id', type: 'integer', description: 'Panel number', required: true, min: 1 },
    { name: 'field', type: 'string', description: 'What to change', required: true, choices: FIELDS },
    { name: 'value', type: 'string', description: 'New value. "none" clears image, footer and color. Style: button or menu.', required: true, maxLength: 2000 },
  ],
  subKey: 'field',
  subcommands: fieldSubcommands(FIELDS, HINTS, [{ name: 'id', type: 'integer', description: 'Panel number', required: true, min: 1 }]),
  async run(ctx, args) {
    const panel = await getPanel(ctx.guild.id, args.id);
    if (!panel) return ctx.reply({ embeds: [embeds.error(`Panel #${args.id} was not found. See \`{prefix}panellist\`.`)] });
    const value = args.value.trim();
    let moved = false;

    switch (args.field) {
      case 'title':
        panel.title = value.slice(0, 200);
        break;
      case 'description':
        panel.description = value.replace(/\\n/g, '\n').slice(0, 2000);
        break;
      case 'color':
        if (isNone(value)) panel.color = null;
        else if (!/^#?[0-9a-f]{6}$/i.test(value)) return ctx.reply({ embeds: [embeds.error('Use a hex color like `#5865F2`, or `none`.')] });
        else panel.color = value;
        break;
      case 'image':
        if (isNone(value)) panel.image = null;
        else if (!embeds.isHttpUrl(value)) return ctx.reply({ embeds: [embeds.error('The image must be a valid http(s) URL, or `none`.')] });
        else panel.image = value;
        break;
      case 'footer':
        panel.footer = isNone(value) ? null : value.slice(0, 200);
        break;
      case 'style': {
        const style = value.toLowerCase();
        if (!['button', 'buttons', 'menu'].includes(style)) return ctx.reply({ embeds: [embeds.error('Style must be `button` or `menu`.')] });
        panel.style = style === 'menu' ? 'menu' : 'button';
        break;
      }
      case 'channel': {
        const id = channelId(value);
        const channel = id ? await ctx.guild.channels.fetch(id).catch(() => null) : null;
        if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
          return ctx.reply({ embeds: [embeds.error('Give me a text channel mention or ID.')] });
        }
        const problem = canPostIn(ctx, channel);
        if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });
        const oldChannel = panel.channelId ? await ctx.guild.channels.fetch(panel.channelId).catch(() => null) : null;
        const oldMessage = oldChannel && panel.messageId ? await oldChannel.messages.fetch(panel.messageId).catch(() => null) : null;
        await postPanel(ctx.guild, panel, channel);
        if (oldMessage) await oldMessage.delete().catch(() => {});
        moved = true;
        break;
      }
      default:
        return ctx.reply({ embeds: [embeds.error(`Unknown field. Choose one of: ${FIELDS.join(', ')}.`)] });
    }

    if (!moved) {
      await panel.save();
      const result = await refreshPanel(ctx.guild, panel).catch((err) => ({ ok: false, reason: err.message }));
      if (!result.ok) return ctx.reply({ embeds: [embeds.error(`Saved, but I could not update the panel message: ${result.reason}`)] });
    } else {
      await TicketPanel.updateOne({ _id: panel._id }, { channelId: panel.channelId, messageId: panel.messageId });
    }
    await logEvent(ctx, 'Ticket panel edited', `Panel #${panel.panelId}: changed **${args.field}**.`);
    return ctx.reply({ embeds: [embeds.success(`Panel **#${panel.panelId}** updated (${args.field}).`)] });
  },
};
