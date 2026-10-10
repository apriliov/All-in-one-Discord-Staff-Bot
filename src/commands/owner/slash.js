const { EmbedBuilder } = require('discord.js');
const config = require('../../config');
const embeds = require('../../utils/embeds');
const { syncSlashCommands, listRegisteredCommands } = require('../../services/registerSlash');

const cut = (text, max = 1000) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

module.exports = {
  name: 'slash',
  aliases: ['slashcmd'],
  description: 'List or sync slash commands (removes old and duplicate ones).',
  category: 'Owner',
  level: 'owner',
  ephemeral: true,
  options: [
    {
      name: 'action',
      type: 'string',
      description: 'list = show registered, sync = overwrite and clean up old ones',
      choices: ['list', 'sync'],
    },
  ],
  async run(ctx, args) {
    const action = args.action || 'list';
    const extraGuildIds = [...ctx.client.guilds.cache.keys()];

    if (action === 'sync') {
      const r = await syncSlashCommands(ctx.client.registry.commands, { clientId: ctx.client.user.id, extraGuildIds });
      const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle('Slash commands synced')
        .setDescription(`**${r.count}** active command(s) in **${r.scope}**.`)
        .addFields({ name: 'Active', value: cut(r.registered.map((n) => `\`${n}\``).join(' ')) });
      embed.addFields({ name: 'Removed (no longer in the code)', value: r.removed.length ? cut(r.removed.map((n) => `\`${n}\``).join(' ')) : 'None' });
      embed.addFields({
        name: 'Duplicates cleared',
        value: r.cleaned.length ? cut(r.cleaned.map((c) => `${c.scope}: ${c.names.length} command(s)`).join('\n')) : 'None',
      });
      return ctx.reply({ embeds: [embed] });
    }

    const scopes = await listRegisteredCommands({ clientId: ctx.client.user.id, extraGuildIds });
    const local = new Set(ctx.client.registry.commands.keys());
    const embed = new EmbedBuilder()
      .setColor(config.colors.brand)
      .setTitle('Registered slash commands')
      .setDescription(`The code has **${local.size}** command(s). A \`⚠️\` means it is registered on Discord but no longer in the code.`);
    for (const s of scopes) {
      if (!s.names.length && s.scope !== 'global') continue;
      embed.addFields({
        name: `${s.scope} (${s.names.length})`,
        value: s.names.length ? cut(s.names.map((n) => (local.has(n) ? `\`${n}\`` : `⚠️\`${n}\``)).join(' ')) : 'Empty',
      });
    }
    const dup = scopes.filter((s) => s.names.length).length > 1;
    embed.setFooter({ text: dup ? 'Commands exist in more than one scope, run: slash sync' : 'Clean. Run "slash sync" if you see a ⚠️' });
    return ctx.reply({ embeds: [embed] });
  },
};
