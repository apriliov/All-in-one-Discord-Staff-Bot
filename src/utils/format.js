const ts = (date, style = 'R') => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;
const truncate = (str, max) => {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
};

module.exports = { ts, truncate };
