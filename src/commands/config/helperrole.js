const GuildConfig = require('../../database/models/GuildConfig');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'helperrole',
  description: 'Add or remove a helper role (run again with the same role to remove it).',
  category: 'Config',
  level: 'admin',
  ephemeral: true,
  options: [{ name: 'role', type: 'role', description: 'Role to toggle', required: true }],
  async run(ctx, args) {
    if (args.role.id === ctx.guild.id) return ctx.reply({ embeds: [embeds.error('You cannot use @everyone as a staff role.')] });
    const has = ctx.config.helperRoleIds.includes(args.role.id);
    await GuildConfig.updateOne(
      { guildId: ctx.guild.id },
      has ? { $pull: { helperRoleIds: args.role.id } } : { $addToSet: { helperRoleIds: args.role.id } },
      { upsert: true }
    );
    return ctx.reply({
      embeds: [embeds.success(has ? `Removed <@&${args.role.id}> from the helper roles.` : `<@&${args.role.id}> is now a helper role.`)],
    });
  },
};
