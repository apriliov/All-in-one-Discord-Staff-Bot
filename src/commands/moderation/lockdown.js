const { EmbedBuilder } = require('discord.js');
const { colors } = require('../../config');
const embeds = require('../../utils/embeds');
const { logEvent } = require('../../services/cases');
const { startLockdown, endLockdown, lockdownCount } = require('../../services/lockdown');

const clip = (list, max = 10) => (list.length > max ? `${list.slice(0, max).join(', ')} +${list.length - max} more` : list.join(', '));

module.exports = {
  name: 'lockdown',
  aliases: ['ld'],
  description: 'Lock ALL text + voice channels for members (on), lift it again (off) or check the state (status).',
  category: 'Moderation',
  level: 'admin',
  options: [
    { name: 'action', type: 'string', required: true, description: 'on = lock everything, off = lift the lockdown, status = show the state', choices: ['on', 'off', 'status'] },
    { name: 'reason', type: 'string', description: 'Reason (written to the log)', maxLength: 300 },
  ],
  async run(ctx, args) {
    if (!ctx.isSlash) ctx.channel.sendTyping().catch(() => {});
    const reason = args.reason || 'No reason given';

    if (args.action === 'status') {
      const n = await lockdownCount(ctx.guild.id);
      return ctx.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(n ? colors.error : colors.success)
            .setTitle(n ? '🚨 Lockdown is ACTIVE' : '✅ No lockdown')
            .setDescription(n ? `**${n}** channel(s) are locked by the lockdown.\nUse \`lockdown off\` to lift it.` : 'Nothing is locked by a lockdown right now.'),
        ],
      });
    }

    if (args.action === 'on') {
      const r = await startLockdown(ctx);
      await logEvent(ctx, '🚨 Lockdown enabled', `**Reason:** ${reason}\nLocked **${r.text + r.voice}** of ${r.total} channel(s) (${r.text} text, ${r.voice} voice).${r.failed.length ? `\nFailed: ${clip(r.failed)}` : ''}`);
      const embed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle('🚨 Lockdown enabled')
        .setDescription(`Members can no longer send messages or use voice.\nStaff and the bot can still talk. Lift it with \`lockdown off\`.\n\n**Reason:** ${reason}`)
        .addFields(
          { name: '💬 Text locked', value: String(r.text), inline: true },
          { name: '🔊 Voice locked', value: String(r.voice), inline: true },
          { name: '⏭️ Already locked', value: String(r.already), inline: true }
        );
      if (r.failed.length) {
        embed.addFields({ name: '⚠️ Failed (check my Manage Roles / Manage Channels permission, then run `lockdown on` again)', value: clip(r.failed) });
      }
      return ctx.reply({ embeds: [embed] });
    }

    const r = await endLockdown(ctx);
    if (!r.total) return ctx.reply({ embeds: [embeds.error('There is no active lockdown.')] });
    await logEvent(ctx, '✅ Lockdown lifted', `**Reason:** ${reason}\nUnlocked **${r.unlocked}** of ${r.total} channel(s).${r.failed ? `\n${r.failed} failed.` : ''}`);
    const embed = new EmbedBuilder()
      .setColor(r.failed ? colors.warn : colors.success)
      .setTitle(r.failed ? '⚠️ Lockdown partly lifted' : '✅ Lockdown lifted')
      .setDescription(`Restored **${r.unlocked}** channel(s) to their original permissions.${r.gone ? `\n${r.gone} channel(s) no longer exist.` : ''}${r.failed ? `\n**${r.failed}** could not be restored. Run \`lockdown off\` again.` : ''}`);
    return ctx.reply({ embeds: [embed] });
  },
};
