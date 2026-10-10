const Giveaway = require('../../database/models/Giveaway');
const embeds = require('../../utils/embeds');
const { parseDuration } = require('../../utils/duration');
const { roleId, isNone } = require('../../utils/parse');
const { refreshMessage } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');
const { fieldSubcommands } = require('../../utils/subcommands');

const FIELDS = ['prize', 'description', 'winners', 'duration', 'extend', 'role', 'bonus', 'image', 'color'];
const HINTS = {
  prize: { about: 'Change the prize.', value: 'New prize.', max: 200 },
  description: { about: 'Change the giveaway description.', value: 'New text. Use \\n for a new line, or "none" to remove it.', max: 1500 },
  winners: { about: 'Change the number of winners.', value: 'Number from 1 to 50.', max: 3 },
  duration: { about: 'Set a new end time, counted from now.', value: 'Duration like 30m, 2h or 1d12h.', max: 20 },
  extend: { about: 'Add more time to the giveaway.', value: 'Extra time like 30m, 2h or 1d12h.', max: 20 },
  role: { about: 'Change the role required to enter.', value: 'Role mention or ID, or "none" to remove it.', max: 100 },
  bonus: { about: 'Change the bonus entries role.', value: '@role [entries 2-20], or "none" to remove it.', max: 100 },
  image: { about: 'Change the giveaway image.', value: 'Image URL (http/https), or "none" to remove it.', max: 500 },
  color: { about: 'Change the embed color.', value: 'Hex color like #5865F2, or "none".', max: 20 },
};
const LIVE_ONLY = ['winners', 'duration', 'extend', 'role', 'bonus'];
const MAX_MS = 365 * 24 * 60 * 60 * 1000;

module.exports = {
  name: 'gedit',
  description: 'Edit a giveaway: prize, description, winners, duration, extend, role, bonus, image, color.',
  category: 'Giveaways',
  level: 'admin',
  options: [
    { name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 },
    { name: 'field', type: 'string', description: 'What to change', required: true, choices: FIELDS },
    { name: 'value', type: 'string', description: 'New value. "none" clears role, bonus, image, color or description.', required: true, maxLength: 1500 },
  ],
  subKey: 'field',
  subcommands: fieldSubcommands(FIELDS, HINTS, [{ name: 'id', type: 'integer', description: 'Giveaway number', required: true, min: 1 }]),
  async run(ctx, args) {
    const g = await Giveaway.findOne({ guildId: ctx.guild.id, giveawayId: args.id });
    if (!g) return ctx.reply({ embeds: [embeds.error(`Giveaway #${args.id} was not found.`)] });
    if (g.status === 'ended' && LIVE_ONLY.includes(args.field)) {
      return ctx.reply({ embeds: [embeds.error(`That giveaway already ended. You can only change the prize, description, image or color. Use \`{prefix}greroll ${g.giveawayId}\` to pick new winners.`)] });
    }

    const value = args.value.trim();
    const set = {};
    let summary;

    switch (args.field) {
      case 'prize':
        set.prize = value.slice(0, 200);
        summary = `Prize is now **${set.prize}**.`;
        break;
      case 'description':
        set.description = isNone(value) ? null : value.replace(/\\n/g, '\n');
        summary = set.description ? 'Description updated.' : 'Description removed.';
        break;
      case 'winners': {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 50) return ctx.reply({ embeds: [embeds.error('Winners must be a number from 1 to 50.')] });
        set.winnerCount = n;
        summary = `Winner count is now **${n}**.`;
        break;
      }
      case 'duration':
      case 'extend': {
        const ms = parseDuration(value);
        if (!ms) return ctx.reply({ embeds: [embeds.error('Invalid duration. Use something like `30m`, `2h` or `1d12h`.')] });
        if (g.status === 'paused') {
          const base = args.field === 'extend' ? g.remainingMs || 0 : 0;
          set.remainingMs = Math.min(base + ms, MAX_MS);
        } else {
          const base = args.field === 'extend' ? new Date(g.endsAt).getTime() : Date.now();
          set.endsAt = new Date(Math.min(base + ms, Date.now() + MAX_MS));
        }
        summary = args.field === 'extend' ? 'Giveaway extended.' : 'New end time set.';
        break;
      }
      case 'role': {
        if (isNone(value)) {
          set.requiredRoleId = null;
          summary = 'Role requirement removed.';
          break;
        }
        const id = roleId(value);
        const role = id ? await ctx.guild.roles.fetch(id).catch(() => null) : null;
        if (!role) return ctx.reply({ embeds: [embeds.error('I could not find that role. Use a mention or a role ID, or `none`.')] });
        set.requiredRoleId = role.id;
        summary = `Entry now requires ${role}.`;
        break;
      }
      case 'bonus': {
        if (isNone(value)) {
          set.bonusRoleId = null;
          set.bonusEntries = 1;
          summary = 'Bonus entries removed.';
          break;
        }
        const [roleToken, entriesToken] = value.split(/\s+/);
        const id = roleId(roleToken);
        const role = id ? await ctx.guild.roles.fetch(id).catch(() => null) : null;
        const entries = entriesToken ? Number(entriesToken) : 2;
        if (!role || !Number.isInteger(entries) || entries < 2 || entries > 20) {
          return ctx.reply({ embeds: [embeds.error('Use: `@role [entries]` with entries from 2 to 20, or `none`.')] });
        }
        set.bonusRoleId = role.id;
        set.bonusEntries = entries;
        summary = `${role} now gets **${entries}x** entries for new entries.`;
        break;
      }
      case 'image':
        if (isNone(value)) set.imageUrl = null;
        else if (!embeds.isHttpUrl(value)) return ctx.reply({ embeds: [embeds.error('The image must be a valid http(s) URL, or `none`.')] });
        else set.imageUrl = value;
        summary = set.imageUrl ? 'Image updated.' : 'Image removed.';
        break;
      case 'color':
        if (isNone(value)) set.color = null;
        else if (!/^#?[0-9a-f]{6}$/i.test(value)) return ctx.reply({ embeds: [embeds.error('Use a hex color like `#5865F2`, or `none`.')] });
        else set.color = value;
        summary = 'Color updated.';
        break;
      default:
        return ctx.reply({ embeds: [embeds.error(`Unknown field. Choose one of: ${FIELDS.join(', ')}.`)] });
    }

    const updated = await Giveaway.findOneAndUpdate({ _id: g._id }, set, { new: true });
    await refreshMessage(ctx.client, updated);
    await logEvent(ctx, 'Giveaway edited', `#${g.giveawayId}: changed **${args.field}**.`);
    return ctx.reply({ embeds: [embeds.success(`Giveaway **#${g.giveawayId}** edited. ${summary}`)] });
  },
};
