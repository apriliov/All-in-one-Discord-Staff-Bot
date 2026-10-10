const TRUE_WORDS = ['true', 'yes', 'y', 'on', '1', 'enable', 'enabled'];
const FALSE_WORDS = ['false', 'no', 'n', 'off', '0', 'disable', 'disabled'];

function extractId(token, pattern) {
  if (!token) return null;
  const match = String(token).trim().match(pattern);
  if (match) return match[1];
  return /^\d{17,20}$/.test(String(token).trim()) ? String(token).trim() : null;
}

const roleId = (token) => extractId(token, /^<@&(\d+)>$/);
const channelId = (token) => extractId(token, /^<#(\d+)>$/);

function parseToggle(token) {
  const word = String(token || '').trim().toLowerCase();
  if (TRUE_WORDS.includes(word)) return true;
  if (FALSE_WORDS.includes(word)) return false;
  return null;
}

const isNone = (token) => ['none', 'off', 'clear', 'reset', 'remove', '-'].includes(String(token || '').trim().toLowerCase());

const CUSTOM_EMOJI = /^<(a?):(\w{2,32}):(\d{17,20})>$/;
const UNICODE_EMOJI = /^\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|\uFE0F|\p{Emoji_Modifier})*$/u;

function emojiObject(value) {
  if (!value) return null;
  const text = String(value).trim();
  const custom = text.match(CUSTOM_EMOJI);
  if (custom) return { animated: custom[1] === 'a', name: custom[2], id: custom[3] };
  if (UNICODE_EMOJI.test(text)) return { name: text };
  return null;
}

const slug = (value, max = 32) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);

module.exports = { extractId, roleId, channelId, parseToggle, isNone, emojiObject, slug };
