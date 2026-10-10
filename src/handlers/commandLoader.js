const fs = require('node:fs');
const path = require('node:path');

const COMMANDS_DIR = path.join(__dirname, '..', 'commands');
const VALID_LEVELS = ['helper', 'admin', 'owner'];
const CATEGORY_ORDER = ['Utility', 'Moderation', 'Modmail', 'Tickets', 'Giveaways', 'Posting', 'Snippets', 'Config', 'Owner'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function loadCommands() {
  const commands = new Map();
  const aliases = new Map();

  for (const file of walk(COMMANDS_DIR)) {
    const cmd = require(file);
    const label = path.relative(COMMANDS_DIR, file);

    if (!cmd.name || !cmd.description || typeof cmd.run !== 'function') {
      throw new Error(`Command file ${label} needs "name", "description" and "run".`);
    }

    if (!/^[a-z0-9_-]{1,32}$/.test(cmd.name)) throw new Error(`Command ${cmd.name}: name must be 1-32 chars of a-z, 0-9, _ or -.`);
    if (cmd.description.length > 100) throw new Error(`Command ${cmd.name}: description is ${cmd.description.length} chars (max 100).`);
    if (!cmd.category) throw new Error(`Command ${cmd.name}: missing "category".`);
    if ((cmd.options || []).length > 25) throw new Error(`Command ${cmd.name}: max 25 options.`);
    for (const opt of cmd.options || []) {
      if (!/^[a-z0-9_-]{1,32}$/.test(opt.name)) throw new Error(`Command ${cmd.name}: invalid option name "${opt.name}".`);
      if (!opt.description || opt.description.length > 100) throw new Error(`Command ${cmd.name}: option "${opt.name}" needs a description of 1-100 chars.`);
    }
    if (!VALID_LEVELS.includes(cmd.level)) throw new Error(`Command ${cmd.name}: invalid level "${cmd.level}".`);
    if (commands.has(cmd.name)) throw new Error(`Duplicate command name "${cmd.name}" (${label}).`);

    let seenOptional = false;
    for (const opt of cmd.options || []) {
      if (!opt.required) seenOptional = true;
      else if (seenOptional) throw new Error(`Command ${cmd.name}: required option "${opt.name}" must come first.`);
    }

    cmd.options = cmd.options || [];
    cmd.aliases = cmd.aliases || [];
    commands.set(cmd.name, cmd);
    for (const alias of cmd.aliases) {
      if (aliases.has(alias) || commands.has(alias)) throw new Error(`Duplicate alias "${alias}" (${label}).`);
      aliases.set(alias, cmd.name);
    }
  }

  const sorted = new Map(
    [...commands.entries()].sort(([, a], [, b]) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name))
  );

  return {
    commands: sorted,
    aliases,
    find(name) {
      return commands.get(name) || commands.get(aliases.get(name));
    },
  };
}

module.exports = { loadCommands };
