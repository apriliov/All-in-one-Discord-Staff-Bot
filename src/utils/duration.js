const UNITS = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000 };

function parseDuration(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/\s+/g, '').toLowerCase();
  if (!/^(\d+[smhdw])+$/.test(cleaned)) return null;
  let total = 0;
  for (const match of cleaned.matchAll(/(\d+)([smhdw])/g)) {
    total += Number(match[1]) * UNITS[match[2]];
  }
  return total > 0 ? total : null;
}

function formatDuration(ms) {
  if (!ms) return '0s';
  const parts = [];
  let rest = Math.floor(ms / 1000);
  for (const [label, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${n}${label}`);
      rest -= n * size;
    }
  }
  return parts.join(' ') || '0s';
}

module.exports = { parseDuration, formatDuration, DAY: UNITS.d, MAX_TIMEOUT: 28 * UNITS.d };
