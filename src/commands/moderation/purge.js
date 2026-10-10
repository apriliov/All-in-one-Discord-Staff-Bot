const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');

module.exports = {
  name: 'purge',
  aliases: ['clear', 'prune'],
  description: 'Bulk delete recent messages in this channel (max 100, newer than 14 days).',
  category: 'Moderation',
  level: 'admin',
  ephemeral: true,
  options: [
    { name: 'amount', type: 'integer', description: 'Number of messages (1-100)', required: true, min: 1, max: 100 },
    { name: 'user', type: 'user', description: 'Only delete messages from this user' },
  ],
  async run(ctx, args) {
    const channel = ctx.channel;
    if (typeof channel.bulkDelete !== 'function') {
      return ctx.reply({ embeds: [embeds.error('I cannot purge messages in this channel.')] });
    }

    if (ctx.message) await ctx.message.delete().catch(() => {});

    let messages = await channel.messages.fetch({ limit: 100 });
    messages = messages.filter((m) => !m.pinned && (!args.user || m.author.id === args.user.id));
    const targets = [...messages.values()].slice(0, args.amount);
    const deleted = await channel.bulkDelete(targets, true);

    await logEvent(
      ctx,
      'Messages purged',
      `**${deleted.size}** message(s) deleted in <#${channel.id}>${args.user ? ` from <@${args.user.id}>` : ''}.`
    );

    const embed = embeds.success(`Deleted **${deleted.size}** message(s).`);
    if (ctx.message) {
      const sent = await ctx.send({ embeds: [embed] });
      setTimeout(() => sent.delete().catch(() => {}), 5000);
      return;
    }
    return ctx.reply({ embeds: [embed] });
  },
};
