const GuildConfig = require('../../database/models/GuildConfig');
const embeds = require('../../utils/embeds');

module.exports = {
  name: 'adminrole',
  description: 'Add or remove a bot admin role (run again with the same role to remove it).',
  category: 'Config',
  level: 'owner',
  ephemeral: true,
  options: [{ name: 'role', type: 'role', description: 'Role to toggle', required: true }],
  async run(ctx, args) {
    if (args.role.id === ctx.guild.id) return ctx.reply({ embeds: [embeds.error('You cannot use @everyone as a staff role.')] });
    const has = ctx.config.adminRoleIds.includes(args.role.id);
    await GuildConfig.updateOne(
      { guildId: ctx.guild.id },
      has ? { $pull: { adminRoleIds: args.role.id } } : { $addToSet: { adminRoleIds: args.role.id } },
      { upsert: true }
    );
    return ctx.reply({
      embeds: [embeds.success(has ? `Removed <@&${args.role.id}> from the admin roles.` : `<@&${args.role.id}> is now an admin role.`)],
    });
  },
};
