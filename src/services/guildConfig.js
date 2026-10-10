const GuildConfig = require('../database/models/GuildConfig');

async function getGuildConfig(guildId) {
  const run = () =>
    GuildConfig.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  try {
    return await run();
  } catch (err) {
    if (err && err.code === 11000) return run();
    throw err;
  }
}

module.exports = { getGuildConfig };
