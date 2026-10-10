const { EmbedBuilder } = require('discord.js');
const { colors } = require('../config');

const success = (text) => new EmbedBuilder().setColor(colors.success).setDescription(`✅ ${text}`);
const error = (text) => new EmbedBuilder().setColor(colors.error).setDescription(`❌ ${text}`);
const info = (text) => new EmbedBuilder().setColor(colors.brand).setDescription(text);

function parseColor(hex, fallback = colors.brand) {
  if (!hex) return fallback;
  const match = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
  return match ? parseInt(match[1], 16) : fallback;
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function customEmbed({ title, description, color, image, footer }) {
  const embed = new EmbedBuilder().setColor(parseColor(color)).setDescription(description);
  if (title) embed.setTitle(title);
  if (image && isHttpUrl(image)) embed.setImage(image);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}

module.exports = { success, error, info, parseColor, isHttpUrl, customEmbed };
