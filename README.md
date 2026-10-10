# Staff Helper Bot

A private Discord bot for **helpers, admins and the owner** of a private server.
It works with **slash commands** and the **prefix `!`** (`!ping` works; change it with `PREFIX` in `.env`).
Data is stored in **MongoDB**. Only the official bot token and the official Discord API are used (no self-bots, no user tokens).

## Project structure

```
src/
  index.js            entry point
  config.js           environment based configuration
  commands/           one file per command, grouped by category
  core/               command context, dispatcher, argument parsing, permissions
  database/           MongoDB connection and models
  events/             Discord event handlers
  handlers/           command and event loaders
  scripts/            deploy-commands.js (npm run deploy)
  services/           modmail, lock, lockdown, cases, moderation, status page...
  utils/              banner, embeds, duration and format helpers
```

## Staff levels

| Level  | Who                                                                                  |
|--------|--------------------------------------------------------------------------------------|
| Owner  | Bot owner. Set one or more user IDs in `OWNER_IDS` in `.env` (comma separated). |
| Admin  | Server owner, members with the *Administrator* permission, or members with an admin role |
| Helper | Members with a helper role                                                           |

Everyone else is ignored (prefix) or politely refused (slash). Staff cannot moderate someone with an equal or higher level.

## Commands

**Utility:** `help`, `ping`, `userinfo`, `serverinfo`, `avatar` (helper) - `status` (admin)
**Moderation:** `warn`, `warnings`, `note`, `notes`, `timeout`, `untimeout`, `cases`, `case`, `slowmode`, `nick` (helper) - `kick`, `softban`, `ban`, `unban`, `delcase`, `clearwarns`, `role`, `purge`, `lock`, `unlock`, `lockdown` (admin)
**Posting:** `post`, `embed`, `editpost` (helper) - `announce`, `dm` (admin)
**Snippets (canned replies):** `snippet`, `snippets` (helper) - `snippetset`, `snippetdelete` (admin)
**Modmail:** `modmail` (admin) - `close` (helper, works in modmail threads and tickets)
**Tickets:** `close`, `claim`, `unclaim`, `tadd`, `tremove`, `trename`, `tpriority`, `closerequest`, `ticketlist` (helper) - `ticketsetup`, `panelcreate`, `paneledit`, `paneldelete`, `panellist`, `panelsend`, `topicadd`, `topicset`, `topicremove` (admin)
**Giveaways:** `glist`, `ginfo` (helper) - `gcreate`, `gedit`, `gend`, `greroll`, `gdelete`, `gpause` (admin)
**Config:** `config`, `setlog`, `helperrole` (admin) - `adminrole` (owner)
**Owner:** `setstatus`, `stats`, `slash` (list/sync slash command)

Examples:

```
!warn @user spamming in #general
!timeout @user 30m being rude
!post #rules Welcome to the server!\nPlease read the rules.
!embed #news Update | We added a new channel.
/embed channel:#news            (leave "content" empty to open a form)
!editpost https://discord.com/channels/... New text
!snippet rules @user
!helperrole @Helper
!setlog #staff-logs
```

Notes:
- `post`, `announce`, `dm`, `snippetset` support `\n` for a new line.
- `post` and `embed` never ping anyone. Only `announce` can ping roles.
- You can only post in channels you could already write in yourself (owner excepted).
- Every case, post, purge, lock, etc. is written to the log channel (`!setlog`).
- `lock` blocks sending, reactions and thread creation for members. It also denies every role that explicitly *allows* sending in that channel (a plain @everyone deny does not beat those). The bot and the helper/admin roles keep talking. The original permissions are saved and `unlock` restores them exactly. In a thread, `lock` uses Discord's thread lock.
- Want helpers to be unable to post? Change `level: 'helper'` to `'admin'` in `src/commands/posting/*.js`.

## Lockdown

`!lockdown on [reason]` (alias `!ld on`, or `/lockdown action:on`) locks **every text, announcement, forum and voice/stage channel** at once, so members cannot send messages, react, create threads, join voice, speak or stream. Staff roles and the bot keep access.

- `lockdown off` puts every permission back exactly as it was. `lockdown status` shows whether a lockdown is active.
- Channels you locked by hand with `lock` are skipped and stay locked after `lockdown off`.
- Categories and the modmail ticket category are skipped.
- A channel created while the lockdown is active is locked automatically.
- Running `lockdown on` again is safe: it only locks what is not locked yet (useful if some channels failed).
- The bot needs **Manage Channels** and **Manage Roles**. Members with the Administrator permission (or the server owner) can never be blocked by Discord.

## Live status page

`/status channel:#status` (or `!status #status`) posts an embed in that channel showing:

- An **OWNER** embed (`STATUS_USER_ID`, defaults to the first `OWNER_IDS` entry) and a separate **BOT** embed (`STATUS_BOT_ID`, defaults to this bot). Each embed has its own color that follows its status (green online, yellow idle, red do not disturb, gray offline).
- A **MODMAIL** embed below them showing Open or Offline in real time, read from the same setting as `/modmail open|close`.
- Each block shows Online, Idle, Do Not Disturb or Offline, the devices (desktop, mobile, web) and **its own activity**: the user's activity comes from the user, the bot's activity comes from the bot (playing, Spotify, watching, streaming, custom status).

The bot asks Discord for the presence of exactly those two IDs (at startup, when you run `/status`, and every 60 seconds), so the bot's activity is read from the bot ID you configured. If one of the accounts is not in the server, its block says so.

It is **event driven**: the embed is edited the moment Discord reports a change, and a 5 second check acts as a safety net. The message is only edited when something really changed. The page survives restarts. Running `/status` again in the same channel replaces the old page. Deleting the message removes the page.

Requirements:

1. Enable **Presence Intent** in the Developer Portal (Bot -> Privileged Gateway Intents). Without it the bot cannot log in.
2. The tracked user and the tracked bot must be **members of the same server** as the bot (Discord only sends presence for shared servers).
3. Change who is tracked with `STATUS_USER_ID` and `STATUS_BOT_ID` in `.env` (optional).

## Modmail

Members DM the bot and a ticket channel is created in the modmail category (set the category ID with `MODMAIL_CATEGORY_ID` in `.env`). All modmail text is in English.

- When a new ticket opens, the user gets a welcome message that explains this is modmail and asks them to describe their problem. The welcome message shows again every time a new ticket is created.
- Normal chat from staff in the ticket channel is sent to the user's DM as **Staff** (the staff name is never visible to the user). The bot reacts with ✅ when it was delivered and ❌ when the user's DMs are closed. Start a message with `//` for an internal note that is not sent.
- When a ticket opens (by DM), the admin role(s) set with `!adminrole` are tagged in the ticket channel. The role must be **mentionable**, or the bot needs the **Mention Everyone** permission (it is in the invite link above), otherwise the tag shows but nobody is notified.
- The ticket info message has a **Close Ticket** button (or use `!close [reason]`). When a ticket is closed: the channel is deleted, the user gets a DM saying it was closed, and the transcript is sent by DM to the staff member who closed it (a copy also goes to the log channel if one is set).
- If the user messages again after a ticket was closed, the welcome message shows again and a new channel is created.
- `!modmail open` / `!modmail close` turns the whole system on or off. While it is **closed**, DMs do not open a channel (existing tickets keep working).
- The bot status is automatic: `<custom status> | Modmail Open` or `<custom status> | Modmail Close`. Change the custom part with `!setstatus <text>` (empty resets it).
- `!modmail welcome` edits the welcome message (slash opens a form, prefix: `!modmail welcome Title | Description`). `!modmail closemsg` edits the message the user gets when a ticket closes. Use `reset` to go back to the default. Variables: `{server}`, `{user}`, `{username}` and, for the close message, `{reason}`.
- The bot needs the **Manage Channels** permission in the ticket category. No extra intent is needed in the Developer Portal for DMs.

Reply style: every command answers with an embed, except `post` and `announce` which send plain text (no embed, no color).

## Setup

1. **Create the bot** at https://discord.com/developers/applications
   - Bot tab: copy the token, then enable **Message Content Intent** (needed for the `z` prefix) and **Presence Intent** (needed for `/status`).
   - General Information tab: copy the Application ID.
2. **Create your own MongoDB database** (free): https://www.mongodb.com/atlas - create a cluster, a database user and copy the connection string.
   Do not use a connection string that someone else shared with you.
3. Copy `.env.example` to `.env` and fill in the values (see the table below).
4. Install and start (Node.js 18 or newer):

   ```
   npm install
   npm run deploy     # registers the slash commands (once, and after adding commands)
   npm start
   ```
   Slash commands are also synced automatically on every start (turn off with `AUTO_DEPLOY=false`).
5. **Invite the bot** (replace `YOUR_CLIENT_ID`):

   ```
   https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1374792445046
   ```
6. In your server, run `!setlog #your-log-channel` and `!helperrole @YourHelperRole`.
   Place the bot's role **above** the roles it should moderate.

## Environment variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token (required) |
| `CLIENT_ID` | Application ID (required) |
| `GUILD_ID` | Server ID used for instant slash command registration (optional) |
| `MONGO_URI` | MongoDB connection string (required) |
| `OWNER_IDS` | Owner user IDs, comma separated |
| `ALLOWED_GUILD_IDS` | Server IDs the bot may stay in, comma separated. Empty = no restriction |
| `AUTO_DEPLOY` | `false` disables the automatic slash command sync on start |
| `DEFAULT_STATUS` | Custom bot status text |
| `PREFIX` | Command prefix. Default `!`. Several prefixes can be separated by commas, e.g. `!,?` |
| `MODMAIL_CATEGORY_ID` | Category where modmail ticket channels are created |
| `STATUS_USER_ID` / `STATUS_BOT_ID` | Accounts tracked by the live status page (optional) |

## Slash command sync (no more piled-up commands)

Every sync **overwrites** the active scope and **clears leftovers** in the other scopes (global, other servers), so old or duplicated commands disappear.

- Automatic on start, or manually: `npm run deploy` (prints the active list + what was removed).
- In Discord (owner): `/slash action:list` shows what is registered (`⚠️` = no longer in the code), `/slash action:sync` cleans it up.

## Discord Terms of Service / Developer Policy

- Official bot account and token only. No self-bots, no scraping, no automation of user accounts.
- Message Content Intent and Presence Intent are privileged intents. It is enabled with a single toggle for bots in fewer than 100 servers.
- The bot only stores server ID, user IDs/usernames, staff IDs, reasons and timestamps of staff actions (cases/notes), plus snippets and settings.
  Tell your staff that this data is stored, and delete it on request (`!delcase`, or remove the documents in MongoDB).
- `ALLOWED_GUILD_IDS` makes the bot leave any server that is not yours.
- The `dm` command sends one message to one member. Do not use it for mass messaging.

## Security

- Never commit `.env`. Never paste tokens, connection strings or cookies into chats or public repositories.
- If a token or password was ever shared publicly, rotate it immediately.

## License

Released under the [MIT License](LICENSE) - Copyright (c) 2026 APRILIOV.
The license notice is printed in the console on every start (`src/utils/banner.js`). The bot refuses to start if that notice is removed or modified.

## Tickets (support panels)

A separate ticket system for support requests inside the server (modmail stays for DMs).

1. `!ticketsetup category <category id>` and `!ticketsetup logs #channel` (logs get the transcripts and ratings). Optional: `!ticketsetup role @Support` (toggle), `limit 3`, `autoclose 48`, `claim on|off`, `feedback on|off`, `transcript on|off`, `userclose on|off`, `ping on|off`, `naming ticket-{number}`. `!ticketsetup` shows everything.
2. `!panelcreate #open-a-ticket Support` posts a panel with one topic. `!paneledit <id> description ...` changes `title`, `description`, `color`, `image`, `footer`, `style` (`button` or `menu`) or `channel`.
3. `!topicadd <panel> Billing` adds topics (buttons or menu entries, max 25). `!topicset <panel> <key> <field> <value>` changes `label`, `emoji`, `description`, `color` (blurple, grey, green, red), `category`, `role` (toggle, per topic support role), `welcome`, `name` (channel name pattern) and `questions`.
   - Questions open a form before the ticket is created, for example: `!topicset 1 billing questions What is your order ID? | Describe the issue [long] | Extra info [optional]` (max 5).
4. Users press a button or pick a menu entry. A private channel is created for the user and the support roles, with **Close** and **Claim** buttons. Closing asks for an optional reason, saves an HTML transcript to the log channel, DMs the user the transcript and a 1-5 star rating, then deletes the channel.

Inside a ticket: `!claim`, `!unclaim`, `!tadd @user`, `!tremove @user`, `!trename <name>`, `!tpriority low|normal|high|urgent`, `!closerequest [note]` (user answers with a button), `!close [reason]`. `!ticketlist` shows all open tickets, `!panellist [id]` shows panels and topic keys.

Notes: members need a helper role to use the prefix/slash commands, but any support role can use the Close and Claim buttons. The bot needs **Manage Channels**, **Manage Roles** (for channel permissions) and **Manage Messages** (pin). Tickets are skipped by `lockdown`.

## Giveaways

Members enter with a button (no reactions needed). Giveaways survive restarts and end automatically.

- `!gcreate #channel 1h 2 Nitro Classic` starts a giveaway (duration like `30m`, `2h`, `1d12h`). The slash version also has `description`, `role` (required role), `bonusrole` + `bonusentries`, `image` and `color`.
- `!gedit <id> <field> <value>` with fields `prize`, `description`, `winners`, `duration` (new time from now), `extend` (add time), `role`, `bonus` (`@role 3`), `image`, `color`. Use `none` to clear.
- `!gend <id>` ends it now, `!greroll <id> [winners]` picks new winners, `!gpause <id>` pauses or resumes, `!gdelete <id>` removes it without winners.
- `!glist [active|ended|all]` and `!ginfo <id>` show giveaways and details.
- Winners are checked again when the giveaway ends (still in the server, still have the required role). They get a DM when possible.
