const { ChannelType, PermissionFlagsBits } = require('discord.js');
const embeds = require('../../utils/embeds');
const { canPostIn } = require('../../core/permissions');
const { parseDuration, formatDuration } = require('../../utils/duration');
const { createGiveaway, jumpLink } = require('../../services/giveaways');
const { logEvent } = require('../../services/cases');

const TEXT_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const MIN_MS = 10 * 1000;
const MAX_MS = 365 * 24 * 60 * 60 * 1000;

module.exports = {
  name: 'gcreate',
  aliases: ['gstart', 'giveaway'],
  description: 'Start a giveaway: channel, duration, number of winners and prize.',
  category: 'Giveaways',
  level: 'admin',
  options: [
    { name: 'channel', type: 'channel', description: 'Channel to host the giveaway in', required: true, channelTypes: TEXT_TYPES },
    { name: 'duration', type: 'string', description: 'How long it runs, e.g. 30m, 2h, 1d12h', required: true, maxLength: 20 },
    { name: 'winners', type: 'integer', description: 'Number of winners (1-50)', required: true, min: 1, max: 50 },
    { name: 'prize', type: 'string', description: 'What is being given away', required: true, maxLength: 200 },
    { name: 'description', type: 'string', description: 'Extra text shown in the giveaway', maxLength: 1500, slashOnly: true },
    { name: 'role', type: 'role', description: 'Role required to enter', slashOnly: true },
    { name: 'bonusrole', type: 'role', description: 'Role that gets bonus entries', slashOnly: true },
    { name: 'bonusentries', type: 'integer', description: 'Entries for the bonus role (2-20)', min: 2, max: 20, slashOnly: true },
    { name: 'image', type: 'string', description: 'Image URL for the giveaway', maxLength: 500, slashOnly: true },
    { name: 'color', type: 'string', description: 'Embed color (hex)', maxLength: 7, slashOnly: true },
  ],
  async run(ctx, args) {
    const problem = canPostIn(ctx, args.channel);
    if (problem) return ctx.reply({ embeds: [embeds.error(problem)] });
    if (!args.channel.permissionsFor(ctx.guild.members.me)?.has(PermissionFlagsBits.EmbedLinks)) {
      return ctx.reply({ embeds: [embeds.error('I need the **Embed Links** permission in that channel.')] });
    }

    const ms = parseDuration(args.duration);
    if (!ms) return ctx.reply({ embeds: [embeds.error('Invalid duration. Use something like `30m`, `2h` or `1d12h`.')] });
    if (ms < MIN_MS || ms > MAX_MS) return ctx.reply({ embeds: [embeds.error('The duration must be between 10 seconds and 365 days.')] });
    if (args.image && !embeds.isHttpUrl(args.image)) return ctx.reply({ embeds: [embeds.error('The image must be a valid http(s) URL.')] });

    const g = await createGiveaway(ctx.client, ctx.guild, args.channel, {
      hostId: ctx.user.id,
      prize: args.prize.trim(),
      description: args.description ? args.description.replace(/\\n/g, '\n') : null,
      imageUrl: args.image || null,
      color: args.color || null,
      winnerCount: args.winners,
      endsAt: new Date(Date.now() + ms),
      requiredRoleId: args.role ? args.role.id : null,
      bonusRoleId: args.bonusrole ? args.bonusrole.id : null,
      bonusEntries: args.bonusrole ? args.bonusentries || 2 : 1,
    });

    await logEvent(ctx, 'Giveaway created', `#${g.giveawayId} in <#${args.channel.id}>: **${g.prize}** (${args.winners} winner(s), ${formatDuration(ms)})`);
    return ctx.reply({ embeds: [embeds.success(`Giveaway **#${g.giveawayId}** started in <#${args.channel.id}>. [Jump to giveaway](${jumpLink(g)})`)] });
  },
};
