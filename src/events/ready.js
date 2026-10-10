const { Events } = require('discord.js');
const config = require('../config');
const { assertLicense } = require('../utils/banner');
const { syncSlashCommands } = require('../services/registerSlash');
const { refreshPresence } = require('../services/status');
const { startStatusPages } = require('../services/statusPage');
const { startGiveawayScheduler } = require('../services/giveaways');
const { startTicketScheduler } = require('../services/tickets');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    assertLicense();
    console.log(`[BOT] Logged in as ${client.user.tag}`);
    client.user.setPresence({ activities: [{ name: config.defaultStatus }], status: 'online' });

    if (config.allowedGuildIds.size > 0) {
      for (const guild of client.guilds.cache.values()) {
        if (!config.isAllowedGuild(guild.id)) {
          console.log(`[BOT] Leaving non-allowed server ${guild.name} (${guild.id})`);
          await guild.leave().catch(() => {});
        }
      }
    }

    await refreshPresence(client).catch((err) => console.warn('[BOT] Could not set the status:', err.message));

    await startStatusPages(client).catch((err) => console.warn('[STATUS] Could not start the status pages:', err.message));

    startTicketScheduler(client);
    startGiveawayScheduler(client);

    if (config.autoDeploy) {
      try {
        const r = await syncSlashCommands(client.registry.commands, {
          clientId: client.user.id,
          extraGuildIds: [...client.guilds.cache.keys()],
        });
        console.log(`[BOT] Slash commands synced (${r.scope}): ${r.count} active -> ${r.registered.join(', ')}`);
        if (r.removed.length) console.log(`[BOT] Removed old commands: ${r.removed.join(', ')}`);
        for (const c of r.cleaned) console.log(`[BOT] Cleared ${c.names.length} leftover command(s) in ${c.scope}`);
      } catch (err) {
        console.error('[BOT] Slash command sync failed:', err.message);
      }
    }
  },
};
