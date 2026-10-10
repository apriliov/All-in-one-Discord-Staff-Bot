const { MessageFlags } = require('discord.js');
const { UsageError, usageOf, resolveSlashArgs, parsePrefixArgs } = require('./args');
const { LEVELS } = require('./permissions');
const embeds = require('../utils/embeds');

async function dispatch(ctx, command, rawArgs = '') {
  try {
    await ctx.init();

    if (ctx.level === LEVELS.none) {
      if (ctx.isSlash) {
        ctx.ephemeral = true;
        await ctx.reply({ embeds: [embeds.error('This bot is restricted to server staff.')] });
      }
      return;
    }
    if (ctx.level < LEVELS[command.level]) {
      ctx.ephemeral = true;
      await ctx.reply({
        embeds: [embeds.error(`This command requires the **${command.level}** level or higher.`)],
      });
      return;
    }

    ctx.ephemeral = !!command.ephemeral;
    if (ctx.isSlash && !command.noDefer) {
      await ctx.interaction.deferReply(command.ephemeral ? { flags: MessageFlags.Ephemeral } : {});
    }

    const args = ctx.isSlash
      ? await resolveSlashArgs(ctx, command.options)
      : await parsePrefixArgs(ctx, command.options, rawArgs);

    await command.run(ctx, args);
  } catch (err) {
    try {
      if (err instanceof UsageError) {
        await ctx.reply({
          embeds: [embeds.error(`${err.message}\nUsage: \`{prefix}${usageOf(command)}\``)],
        });
      } else {
        console.error(`[ERROR] Command "${command.name}" failed:`, err);
        await ctx.reply({ embeds: [embeds.error('Something went wrong while running that command.')] });
      }
    } catch (replyErr) {
      console.error('[ERROR] Could not send the error message:', replyErr.message);
    }
  }
}

module.exports = { dispatch };
