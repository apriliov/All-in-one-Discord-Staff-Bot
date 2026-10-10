const crypto = require('node:crypto');
const os = require('node:os');
const pkg = require('../../package.json');

const AUTHOR = 'APRILIOV';

const ART = [
  ' █████╗ ██████╗ ██████╗ ██╗██╗     ██╗ ██████╗ ██╗   ██╗',
  '██╔══██╗██╔══██╗██╔══██╗██║██║     ██║██╔═══██╗██║   ██║',
  '███████║██████╔╝██████╔╝██║██║     ██║██║   ██║██║   ██║',
  '██╔══██║██╔═══╝ ██╔══██╗██║██║     ██║██║   ██║╚██╗ ██╔╝',
  '██║  ██║██║     ██║  ██║██║███████╗██║╚██████╔╝ ╚████╔╝',
  '╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚═╝ ╚═════╝   ╚═══╝'
];

const LICENSE_LINES = [
  'MIT License - Copyright (c) 2026 APRILIOV',
  'Permission is granted to use, copy, modify and distribute this software,',
  'provided that this copyright and license notice stays in all copies.',
  'The software is provided "as is", without warranty of any kind.',
];

const FEATURES = [
  'Slash commands and prefix commands (choose your own prefix with PREFIX in .env)',
  'Moderation toolkit: warn, timeout, kick, ban, softban, purge and a full case history',
  'Modmail: private tickets, transcripts, open/close switch and editable welcome and close messages',
  'Ticket system: panels with buttons or menus, topics, forms, claim, priority, transcripts, ratings and auto-close',
  'Giveaways: button entry, requirements, bonus entries, edit, pause, end, reroll and list',
  'Channel lock and server-wide lockdown with exact permission restore',
  'Live status page with real-time presence tracking',
  'Snippets: canned replies for the staff team',
  'Posting tools: post, embed, edit post, announce and direct messages',
  'Role based staff levels: helper, admin and owner',
  'MongoDB storage with automatic slash command sync',
];

const EXPECTED_HASH = '0fe34812e79862ebf2aac1fc1e4f8ea5e38a1248ee5b07201fbba385b57a7efd';

const state = { shown: false };

const fingerprint = () => crypto.createHash('sha256').update(JSON.stringify({ AUTHOR, ART, LICENSE_LINES })).digest('hex');

function fail() {
  console.error('[LICENSE] The license notice is missing or has been modified. The bot cannot start.');
  process.exit(1);
}

function assertLicense() {
  if (fingerprint() !== EXPECTED_HASH || !state.shown) fail();
}

function printBanner(commandCount) {
  if (fingerprint() !== EXPECTED_HASH) fail();
  const line = '='.repeat(72);
  const out = [
    '',
    ...ART,
    '',
    line,
    `  Staff Helper Bot v${pkg.version}  |  Made by ${AUTHOR}`,
    `  Node ${process.version}  |  ${os.platform()} ${os.arch()}${commandCount ? `  |  ${commandCount} commands loaded` : ''}`,
    line,
    '  FEATURES',
    ...FEATURES.map((f) => `   - ${f}`),
    line,
    '  LICENSE',
    ...LICENSE_LINES.map((l) => `   ${l}`),
    line,
    '',
  ];
  console.log(out.join('\n'));
  state.shown = true;
}

module.exports = { printBanner, assertLicense, fingerprint };
