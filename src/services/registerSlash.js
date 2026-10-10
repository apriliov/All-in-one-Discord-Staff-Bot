const { REST, Routes } = require('discord.js');
const config = require('../config');
const { buildSlashCommand } = require('../core/args');

const makeRest = () => new REST({ version: '10' }).setToken(config.token);

function knownGuildIds(extra = []) {
  const ids = new Set([...config.allowedGuildIds, ...extra]);
  if (config.guildId) ids.add(config.guildId);
  return [...ids];
}

async function syncSlashCommands(commands, { clientId = config.clientId, extraGuildIds = [] } = {}) {
  if (!clientId) throw new Error('CLIENT_ID is missing in .env.');
  const rest = makeRest();
  const body = [...commands.values()].map((cmd) => buildSlashCommand(cmd).toJSON());
  const wanted = new Set(body.map((c) => c.name));

  const activeRoute = config.guildId
    ? Routes.applicationGuildCommands(clientId, config.guildId)
    : Routes.applicationCommands(clientId);

  const before = await rest.get(activeRoute);
  const removed = before.filter((c) => !wanted.has(c.name)).map((c) => c.name);
  await rest.put(activeRoute, { body });

  const cleaned = [];
  const clearRoute = async (route, label) => {
    const existing = await rest.get(route);
    if (!existing.length) return;
    await rest.put(route, { body: [] });
    cleaned.push({ scope: label, names: existing.map((c) => c.name) });
  };

  if (config.guildId) await clearRoute(Routes.applicationCommands(clientId), 'global');
  for (const gid of knownGuildIds(extraGuildIds)) {
    if (gid === config.guildId) continue;
    await clearRoute(Routes.applicationGuildCommands(clientId, gid), `server ${gid}`).catch(() => {});
  }

  return {
    count: body.length,
    scope: config.guildId ? `server ${config.guildId}` : 'global',
    registered: body.map((c) => c.name).sort(),
    removed,
    cleaned,
  };
}

async function listRegisteredCommands({ clientId = config.clientId, extraGuildIds = [] } = {}) {
  if (!clientId) throw new Error('CLIENT_ID is missing in .env.');
  const rest = makeRest();
  const out = [];
  const globalCmds = await rest.get(Routes.applicationCommands(clientId));
  out.push({ scope: 'global', names: globalCmds.map((c) => c.name).sort() });
  for (const gid of knownGuildIds(extraGuildIds)) {
    const cmds = await rest.get(Routes.applicationGuildCommands(clientId, gid)).catch(() => null);
    if (cmds) out.push({ scope: `server ${gid}`, names: cmds.map((c) => c.name).sort() });
  }
  return out;
}

const registerSlashCommands = (commands, clientId) => syncSlashCommands(commands, { clientId });

module.exports = { syncSlashCommands, listRegisteredCommands, registerSlashCommands };
