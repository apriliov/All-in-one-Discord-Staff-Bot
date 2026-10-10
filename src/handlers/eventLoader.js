const fs = require('node:fs');
const path = require('node:path');

function loadEvents(client) {
  const dir = path.join(__dirname, '..', 'events');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) {
    const event = require(path.join(dir, file));
    const handler = (...args) => event.execute(client, ...args);
    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);
  }
}

module.exports = { loadEvents };
