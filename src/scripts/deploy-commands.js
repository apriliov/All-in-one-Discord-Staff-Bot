const config = require('../config');
const { loadCommands } = require('../handlers/commandLoader');
const { syncSlashCommands } = require('../services/registerSlash');

(async () => {
  if (!config.token) throw new Error('DISCORD_TOKEN is missing in .env.');
  const registry = loadCommands();
  const r = await syncSlashCommands(registry.commands);
  console.log(`Registered ${r.count} slash commands (${r.scope}):`);
  console.log('  ' + r.registered.join(', '));
  if (r.removed.length) console.log(`Removed old commands: ${r.removed.join(', ')}`);
  for (const c of r.cleaned) console.log(`Cleared ${c.names.length} leftover command(s) in ${c.scope}: ${c.names.join(', ')}`);
})().catch((err) => {
  console.error('Deploy failed:', err.message);
  process.exit(1);
});
