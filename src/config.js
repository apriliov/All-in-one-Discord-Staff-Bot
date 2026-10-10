require('dotenv').config();

const split = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const prefixes = split(process.env.PREFIX);
if (prefixes.length === 0) prefixes.push('!');

const ownerIds = new Set(split(process.env.OWNER_IDS));
const allowedGuildIds = new Set(split(process.env.ALLOWED_GUILD_IDS));

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  mongoUri: process.env.MONGO_URI,
  autoDeploy: String(process.env.AUTO_DEPLOY).toLowerCase() !== 'false',
  defaultStatus: process.env.DEFAULT_STATUS || 'Helping the staff team',
  prefixes,
  prefix: prefixes[0],
  ownerIds,
  allowedGuildIds,
  isAllowedGuild: (guildId) => allowedGuildIds.size === 0 || allowedGuildIds.has(guildId),
  colors: {
    brand: 0x5865f2,
    success: 0x57f287,
    error: 0xed4245,
    warn: 0xfee75c,
    mod: 0xeb459e,
    neutral: 0x2b2d31,
    white: 0xffffff,
  },
  statusTargets: {
    userId: process.env.STATUS_USER_ID || [...ownerIds][0] || null,
    botId: process.env.STATUS_BOT_ID || process.env.CLIENT_ID || null,
  },
  modmail: {
    categoryId: process.env.MODMAIL_CATEGORY_ID || null,
  },
};
