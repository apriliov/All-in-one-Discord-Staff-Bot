# Staff Helper Bot

A private Discord bot for the **helpers, admins and owner** of a private server.
It works with **slash commands** and a **text prefix** (default `!`, so `!ping` works).
Data is stored in **MongoDB**. Only the official bot token and the official Discord API are used (no self-bots, no user tokens).

Need help or found a bug? Join our Discord server at https://support.namaiki.xyz or report bugs in this code to the email team@namaiki.xyz.

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Environment variables (.env)](#environment-variables-env)
- [Staff levels](#staff-levels)
- [Commands](#commands)
- [Feature guides](#feature-guides)
  - [Modmail](#modmail)
  - [Tickets](#tickets-support-panels)
  - [Giveaways](#giveaways)
  - [Lock and lockdown](#lock-and-lockdown)
  - [Live status page](#live-status-page)
  - [Slash command sync](#slash-command-sync)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Discord Terms of Service / Developer Policy](#discord-terms-of-service--developer-policy)
- [Security](#security)
- [License](#license)

---

## Features

- **Moderation toolkit:** warn, timeout, kick, ban, softban, purge and a full case history.
- **Modmail:** private tickets from DMs, transcripts, open/close switch and editable welcome and close messages.
- **Ticket system:** panels with buttons or menus, topics, forms, claim, priority, transcripts, ratings and auto-close.
- **Giveaways:** button entry, requirements, bonus entries, edit, pause, end, reroll and list.
- **Lock and lockdown:** lock one channel or the whole server, with exact permission restore.
- **Live status page:** real-time presence of the owner, the bot and modmail.
- **Snippets:** canned replies for the staff team.
- **Posting tools:** post, embed, edit post, announce and direct messages.
- **Staff levels:** helper, admin and owner.
- **Automatic slash command sync** on every start.

---

## Quick start

You need **Node.js 18 or newer**.

### 1. Create the bot

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **New Application**.
2. **General Information** tab: copy the **Application ID** (this is your `CLIENT_ID`).
3. **Bot** tab:
   - Click **Reset Token** and copy the token (this is your `DISCORD_TOKEN`).
   - Under **Privileged Gateway Intents**, enable **Message Content Intent** (needed for prefix commands) and **Presence Intent** (needed for the status page). The bot cannot log in without them.

### 2. Create a MongoDB database

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a **database user** (username + password).
3. In **Network Access**, allow the IP address of the machine that runs the bot.
4. Click **Connect -> Drivers** and copy the connection string (this is your `MONGO_URI`). Replace `<password>` with your user's password.

Use your own database. Never use a connection string that someone else shared with you.

### 3. Configure `.env`

Copy `.env.example` to `.env` and fill it in. See [Environment variables](#environment-variables-env) for what each value means and where to find it.

```bash
cp .env.example .env
```

### 4. Install and start

```bash
npm install
npm run deploy     # registers the slash commands (optional, see note below)
npm start
```

Slash commands are also synced automatically on every start (turn it off with `AUTO_DEPLOY=false`), so `npm run deploy` is only needed if you want to register them without starting the bot.

### 5. Invite the bot

Replace `YOUR_CLIENT_ID` with your Application ID:

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot+applications.commands&permissions=1374792445046
```

### 6. First setup in your server

```
!setlog #staff-logs          sets the staff log channel
!helperrole @Helper          adds a helper role (run again to remove it)
```

Place the bot's role **above** every role it should moderate.

---

## Environment variables (.env)

Rules for the `.env` file: one variable per line, `NAME=value`, **no spaces around `=`**, no quotes, no comments on the same line. Leave a value empty (or delete the line) for optional settings you do not need.

Turn on **Developer Mode** in Discord (User Settings -> Advanced) so you can right-click a user, server, channel or category and choose **Copy ID**.

| Variable | Required | Default | What to put there |
|----------|:--------:|---------|-------------------|
| `DISCORD_TOKEN` | Yes | - | Bot token. Developer Portal -> **Bot** -> **Reset Token**. |
| `CLIENT_ID` | Yes | - | Application ID. Developer Portal -> **General Information**. |
| `MONGO_URI` | Yes | - | MongoDB connection string, e.g. `mongodb+srv://user:password@cluster.mongodb.net/staffbot`. If the password has special characters (`@ : / ?`), URL-encode them. |
| `OWNER_IDS` | Recommended | empty | Your Discord user ID. Several owners can be separated by commas: `111111111111111111,222222222222222222`. Without it, owner-only commands are unavailable. |
| `GUILD_ID` | No | empty | ID of your main server. Slash commands show up instantly in that server, and modmail uses it as the main server. If empty, the first server in `ALLOWED_GUILD_IDS` (or the first server the bot is in) is used. |
| `ALLOWED_GUILD_IDS` | No | empty (no limit) | Server IDs the bot may stay in, comma separated. The bot leaves every other server. |
| `AUTO_DEPLOY` | No | on | Set to `false` to stop the automatic slash command sync on start. Any other value (or empty) keeps it on. |
| `DEFAULT_STATUS` | No | `Helping the staff team` | Custom text of the bot status. The bot adds `| Modmail Open` or `| Modmail Close` automatically. |
| `PREFIX` | No | `!` | Command prefix. Anyone can change it here. Several prefixes can be separated by commas, e.g. `!,?`. The first one is shown in the bot's messages. |
| `MODMAIL_CATEGORY_ID` | No | empty | ID of the category where modmail ticket channels are created. |
| `STATUS_USER_ID` | No | first `OWNER_IDS` entry | User tracked by the live status page. |
| `STATUS_BOT_ID` | No | `CLIENT_ID` | Bot tracked by the live status page. |

Example `.env`:

```env
DISCORD_TOKEN=your-bot-token
CLIENT_ID=123456789012345678
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/staffbot
OWNER_IDS=123456789012345678
GUILD_ID=123456789012345678
ALLOWED_GUILD_IDS=123456789012345678
AUTO_DEPLOY=true
DEFAULT_STATUS=Helping the staff team
PREFIX=!
MODMAIL_CATEGORY_ID=123456789012345678
STATUS_USER_ID=
STATUS_BOT_ID=
```

Never commit `.env` or share its contents (`.env` is already in `.gitignore`).

---

## Staff levels

| Level | Who |
|-------|-----|
| **Owner** | Bot owner. Set one or more user IDs in `OWNER_IDS`. |
| **Admin** | Server owner, members with the *Administrator* permission, or members with an admin role (`!adminrole`). |
| **Helper** | Members with a helper role (`!helperrole`). |

Everyone else is ignored (prefix) or politely refused (slash). Staff cannot moderate someone with an equal or higher level. A higher level can always use the commands of a lower level.

---

## Commands

Every command works as a slash command (`/warn`) and with your text prefix (`!warn`). Examples in this README use the default prefix `!`. If you changed `PREFIX` in `.env`, use your own prefix instead. Use `help` to see the commands you can use, or `help <command>` for details.

Commands that have several actions or editable fields show up in Discord's slash menu as **subcommands**, for example `/modmail welcome`, `/lockdown on`, `/ticketsetup claim` or `/paneledit title`. With the prefix you write the same thing as plain text (`!modmail welcome`, `!lockdown on`, `!ticketsetup claim on`, `!paneledit 1 title ...`).

### Utility

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `help` | `h`, `commands` | Helper | Show the commands you can use, or details about one command. |
| `ping` | | Helper | Check the bot latency. |
| `userinfo` | `ui`, `whois` | Helper | Show information and staff history for a user. |
| `serverinfo` | `si` | Helper | Show information about this server. |
| `avatar` | `av` | Helper | Show the avatar of a user. |
| `status` | | Admin | Post the [live status page](#live-status-page) in a channel. |

### Moderation

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `warn` | `w` | Helper | Warn a member and record it in the case log. |
| `warnings` | `warns` | Helper | Show the warnings of a user. |
| `note` | | Helper | Add a private staff note to a user (the user is not notified). |
| `notes` | | Helper | Show the staff notes of a user. |
| `timeout` | `mute`, `to` | Helper | Time a member out (helpers: up to 1 day, admins: up to 28 days). |
| `untimeout` | `unmute` | Helper | Remove a timeout from a member. |
| `cases` | `history` | Helper | Show the full staff history (all cases) of a user. |
| `case` | | Helper | Show the details of one case. |
| `slowmode` | `sm` | Helper | Set the slowmode of this channel (`0` turns it off). |
| `nick` | `nickname` | Helper | Change or reset the nickname of a member. |
| `kick` | | Admin | Kick a member from the server. |
| `softban` | | Admin | Ban and instantly unban a member to delete their last 7 days of messages. |
| `ban` | | Admin | Ban a user (also works on users who already left). |
| `unban` | | Admin | Remove a ban from a user. |
| `delcase` | | Admin | Delete a warning or note from the case log. |
| `clearwarns` | `clearwarnings` | Admin | Delete all warnings of a user (notes and other cases stay). |
| `role` | | Admin | Add a role to a member, or remove it if they already have it. |
| `purge` | `clear`, `prune` | Admin | Bulk delete recent messages in this channel (max 100, newer than 14 days). |
| `lock` | | Admin | Stop members from sending messages in a channel. |
| `unlock` | | Admin | Let members send messages in a channel again. |
| `lockdown` | `ld` | Admin | Lock **all** channels (`on`), lift it (`off`) or check the state (`status`). |

### Posting

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `post` | `say` | Helper | Send a message to a channel as the bot (no pings). Use `\n` for a new line. |
| `embed` | | Helper | Post an embed. Prefix: `Title \| Description`. Slash without content opens a form. |
| `editpost` | | Helper | Edit a message that this bot posted (text or embed description). |
| `announce` | | Admin | Post an announcement that is allowed to ping roles (and `@everyone` if you can). |
| `dm` | | Admin | Send a direct message to one member as the server staff. |

### Snippets (canned replies)

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `snippet` | `s`, `tag` | Helper | Send a saved snippet, optionally pinging a user. |
| `snippets` | | Helper | List all saved snippets. |
| `snippetset` | | Admin | Create or update a snippet. |
| `snippetdelete` | `snippetremove` | Admin | Delete a snippet. |

### Modmail

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `modmail` | | Admin | `status`, `open`, `close` the system, or edit the `welcome` and `closemsg` messages. Slash: `/modmail <subcommand>`. |
| `close` | `ticketclose`, `tclose` | Helper | Close the modmail thread or ticket in this channel. A transcript is saved. |

### Tickets

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `ticketsetup` | | Admin | Configure the ticket system (category, logs, support roles, limits, options). |
| `panelcreate` | | Admin | Create a ticket panel (with a first topic) in a channel. |
| `paneledit` | | Admin | Edit a panel: `title`, `description`, `color`, `image`, `footer`, `style`, `channel`. |
| `panelsend` | | Admin | Post a panel again (removes the old message). Use it if the message was deleted. |
| `panellist` | `panels`, `panelinfo` | Admin | List the panels, or show one panel with its topics. |
| `paneldelete` | | Admin | Delete a panel and its message. Open tickets stay open. |
| `topicadd` | | Admin | Add a topic (button or menu entry) to a panel. |
| `topicset` | | Admin | Edit a topic: `label`, `emoji`, `description`, `color`, `category`, `role`, `welcome`, `name`, `questions`. |
| `topicremove` | | Admin | Remove a topic from a panel. |
| `ticketlist` | `opentickets` | Helper | List the open support tickets. |
| `claim` | | Helper | Claim the ticket in this channel. |
| `unclaim` | | Helper | Release your claim on the ticket. |
| `tadd` | `adduser` | Helper | Add a user to the ticket. |
| `tremove` | `removeuser` | Helper | Remove a user from the ticket. |
| `trename` | `ticketrename` | Helper | Rename the ticket channel (Discord allows 2 renames per 10 minutes). |
| `tpriority` | `priority` | Helper | Set the priority: `low`, `normal`, `high` or `urgent`. |
| `closerequest` | `crq` | Helper | Ask the ticket owner if the ticket can be closed (they answer with a button). |
| `close` | `ticketclose`, `tclose` | Helper | Close the ticket in this channel. |

### Giveaways

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `gcreate` | `gstart`, `giveaway` | Admin | Start a giveaway. |
| `gedit` | | Admin | Edit a giveaway: `prize`, `description`, `winners`, `duration`, `extend`, `role`, `bonus`, `image`, `color`. |
| `gend` | | Admin | End a giveaway right now and pick the winners. |
| `greroll` | `reroll` | Admin | Pick new winner(s) for an ended giveaway. |
| `gpause` | `gresume` | Admin | Pause a running giveaway, or resume a paused one. |
| `gdelete` | `gcancel` | Admin | Delete a giveaway and its message. No winners are picked. |
| `glist` | `giveaways` | Helper | List the giveaways of this server. |
| `ginfo` | | Helper | Show the details of one giveaway. |

### Config

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `config` | | Admin | Show the bot settings of this server. |
| `setlog` | | Admin | Set the staff log channel. Leave empty to turn logging off. |
| `helperrole` | | Admin | Add or remove a helper role (run again with the same role to remove it). |
| `adminrole` | | Owner | Add or remove a bot admin role. |

### Owner

| Command | Aliases | Level | Description |
|---------|---------|:-----:|-------------|
| `setstatus` | | Owner | Set the custom part of the bot status. Empty resets it. |
| `stats` | | Owner | Show bot statistics. |
| `slash` | `slashcmd` | Owner | List or sync slash commands. |

### Examples

```
!warn @user spamming in #general
!timeout @user 30m being rude
!post #rules Welcome to the server!\nPlease read the rules.
!embed #news Update | We added a new channel.
/embed channel:#news                  (leave "content" empty to open a form)
!editpost https://discord.com/channels/... New text
!snippet rules @user
!gcreate #giveaways 1h 2 Nitro Classic
!ticketsetup category 123456789012345678
!helperrole @Helper
!setlog #staff-logs
```

### Notes

- `post`, `announce`, `dm` and `snippetset` support `\n` for a new line.
- `post` and `embed` never ping anyone. Only `announce` can ping roles.
- You can only post in channels you could already write in yourself (owner excepted).
- Every case, post, purge, lock and similar action is written to the log channel (`!setlog`).
- Every command answers with an embed, except `post` and `announce`, which send plain text.
- Want helpers to be unable to post? Change `level: 'helper'` to `'admin'` in `src/commands/posting/*.js`.

---

## Feature guides

### Modmail

Members DM the bot and a ticket channel is created in the modmail category (set it with `MODMAIL_CATEGORY_ID`). All modmail text is in English.

- When a ticket opens, the user gets a welcome message that explains this is modmail and asks them to describe their problem. It shows again every time a new ticket is created.
- Normal chat from staff in the ticket channel is sent to the user's DM as **Staff** (the staff name is never visible to the user). The bot reacts with ✅ when it was delivered and ❌ when the user's DMs are closed. Start a message with `//` for an internal note that is not sent.
- When a ticket opens, the admin role(s) set with `!adminrole` are tagged in the ticket channel. The role must be **mentionable**, or the bot needs the **Mention Everyone** permission (already in the invite link), otherwise nobody is notified.
- The ticket info message has a **Close Ticket** button (or use `!close [reason]`). When a ticket is closed, the channel is deleted, the user gets a DM, and the transcript is sent by DM to the staff member who closed it (a copy also goes to the log channel if one is set).
- If the user messages again after a ticket was closed, the welcome message shows again and a new channel is created.
- `/modmail open` / `/modmail close` (or `!modmail open` / `!modmail close`) turns the whole system on or off. `/modmail status` shows the current state. While it is **closed**, DMs do not open a channel (existing tickets keep working).
- The bot status is automatic: `<custom status> | Modmail Open` or `<custom status> | Modmail Close`. Change the custom part with `!setstatus <text>` (empty resets it).
- `/modmail welcome` edits the welcome message (slash opens a form, prefix: `!modmail welcome Title | Description`). `/modmail closemsg` edits the message the user gets when a ticket closes. Use `reset` to go back to the default. Variables: `{server}`, `{user}`, `{username}` and, for the close message, `{reason}`.
- The bot needs **Manage Channels** in the ticket category. No extra intent is needed for DMs.

### Tickets (support panels)

A separate ticket system for support requests inside the server (modmail stays for DMs).

1. **Configure:** `!ticketsetup category <category id>` and `!ticketsetup logs #channel` (logs get the transcripts and ratings).
   Optional settings: `role @Support` (toggle), `limit 3`, `autoclose 48`, `claim on|off`, `feedback on|off`, `transcript on|off`, `userclose on|off`, `ping on|off`, `naming ticket-{number}`. Run `!ticketsetup` alone to see everything. Use `none` to clear a value.
2. **Create a panel:** `!panelcreate #open-a-ticket Support` posts a panel with one topic. `!paneledit <id> description ...` changes `title`, `description`, `color`, `image`, `footer`, `style` (`button` or `menu`) or `channel`.
3. **Add topics:** `!topicadd <panel> Billing` adds buttons or menu entries (max 25). `!topicset <panel> <key> <field> <value>` changes `label`, `emoji`, `description`, `color` (blurple, grey, green, red), `category`, `role` (toggle, per-topic support role), `welcome`, `name` (channel name pattern) and `questions`.
   - Questions open a form before the ticket is created, for example:
     `!topicset 1 billing questions What is your order ID? | Describe the issue [long] | Extra info [optional]` (max 5).
4. **Users open tickets** by pressing a button or picking a menu entry. A private channel is created for the user and the support roles, with **Close** and **Claim** buttons. Closing asks for an optional reason, saves an HTML transcript to the log channel, DMs the user the transcript and a 1-5 star rating, then deletes the channel.

Inside a ticket: `!claim`, `!unclaim`, `!tadd @user`, `!tremove @user`, `!trename <name>`, `!tpriority low|normal|high|urgent`, `!closerequest [note]`, `!close [reason]`.
`!ticketlist` shows all open tickets, `!panellist [id]` shows panels and topic keys.

Notes: members need a helper role to use the prefix/slash commands, but any support role can use the Close and Claim buttons. The bot needs **Manage Channels**, **Manage Roles** (channel permissions) and **Manage Messages** (pin). Tickets are skipped by `lockdown`.

### Giveaways

Members enter with a button (no reactions needed). Giveaways survive restarts and end automatically.

- `!gcreate #channel 1h 2 Nitro Classic` starts a giveaway (duration like `30m`, `2h`, `1d12h`). The slash version also has `description`, `role` (required role), `bonusrole` + `bonusentries`, `image` and `color`.
- `!gedit <id> <field> <value>` with fields `prize`, `description`, `winners`, `duration` (new time from now), `extend` (add time), `role`, `bonus` (`@role 3`), `image`, `color`. Use `none` to clear.
- `!gend <id>` ends it now, `!greroll <id> [winners]` picks new winners, `!gpause <id>` pauses or resumes, `!gdelete <id>` removes it without winners.
- `!glist [active|ended|all]` and `!ginfo <id>` show giveaways and details.
- Winners are checked again when the giveaway ends (still in the server, still have the required role). They get a DM when possible.

### Lock and lockdown

**`lock` / `unlock`** work on one channel. `lock` blocks sending, reactions and thread creation for members. It also denies every role that explicitly *allows* sending in that channel (a plain `@everyone` deny does not beat those). The bot and the helper/admin roles keep talking. The original permissions are saved and `unlock` restores them exactly. In a thread, `lock` uses Discord's thread lock.

**`lockdown`** (`!lockdown on [reason]`, alias `!ld on`, or `/lockdown on`) locks **every text, announcement, forum and voice/stage channel** at once, so members cannot send messages, react, create threads, join voice, speak or stream. Staff roles and the bot keep access.

- `lockdown off` puts every permission back exactly as it was. `lockdown status` shows whether a lockdown is active.
- Channels you locked by hand with `lock` are skipped and stay locked after `lockdown off`.
- Categories and the modmail ticket category are skipped.
- A channel created while the lockdown is active is locked automatically.
- Running `lockdown on` again is safe: it only locks what is not locked yet (useful if some channels failed).
- The bot needs **Manage Channels** and **Manage Roles**. Members with the Administrator permission (or the server owner) can never be blocked by Discord.

### Live status page

`/status channel:#status` (or `!status #status`) posts embeds in that channel showing:

- An **OWNER** embed (`STATUS_USER_ID`, defaults to the first `OWNER_IDS` entry) and a separate **BOT** embed (`STATUS_BOT_ID`, defaults to this bot). Each embed has its own color that follows its status (green online, yellow idle, red do not disturb, gray offline).
- A **MODMAIL** embed showing Open or Offline in real time, read from the same setting as `/modmail open|close`.
- For each account: Online, Idle, Do Not Disturb or Offline, the devices (desktop, mobile, web) and its own activity (playing, Spotify, watching, streaming, custom status).

It is **event driven**: the embed is edited the moment Discord reports a change, and a 5 second check acts as a safety net. The bot also asks Discord for the presence of exactly those two IDs at startup, when you run `/status`, and every 60 seconds. The message is only edited when something really changed. The page survives restarts. Running `/status` again in the same channel replaces the old page. Deleting the message removes the page.

Requirements:

1. **Presence Intent** enabled in the Developer Portal (Bot -> Privileged Gateway Intents).
2. The tracked user and the tracked bot must be **members of the same server** as the bot (Discord only sends presence for shared servers). If one of them is not in the server, its block says so.
3. Optionally change who is tracked with `STATUS_USER_ID` and `STATUS_BOT_ID` in `.env`.

### Slash command sync

Every sync **overwrites** the active scope and **clears leftovers** in the other scopes (global, other servers), so old or duplicated commands disappear.

- Automatic on start, or manually with `npm run deploy` (prints the active list and what was removed).
- In Discord (owner): `/slash list` shows what is registered (`⚠️` = no longer in the code), `/slash sync` cleans it up.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `DISCORD_TOKEN is missing` | `.env` does not exist, is not in the project root, or the token line is empty. |
| `Used disallowed intents` when starting | Enable **Message Content Intent** and **Presence Intent** in the Developer Portal (Bot tab). |
| `[FATAL]` with a MongoDB error | Check `MONGO_URI` (password, URL-encoding of special characters) and that your IP is allowed in Atlas **Network Access**. |
| Prefix commands do nothing | Check that Message Content Intent is on, that you have a helper/admin role, and that `PREFIX` matches what you type. |
| Slash commands do not appear | Wait a moment after start, or run `npm run deploy`. Set `GUILD_ID` for instant updates in your server. Make sure the bot was invited with the `applications.commands` scope. |
| `OWNER_IDS is empty` warning | Add your user ID to `OWNER_IDS`. Owner-only commands stay unavailable until then. |
| Bot cannot lock, ban or manage tickets | Give it the needed permissions and move its role **above** the roles it manages. |
| Bot left my server | `ALLOWED_GUILD_IDS` is set and does not include that server ID. |

---

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
  services/           modmail, tickets, giveaways, lock, lockdown, cases, moderation, status page...
  utils/              banner, embeds, duration and format helpers
```

---

## Discord Terms of Service / Developer Policy

- Official bot account and token only. No self-bots, no scraping, no automation of user accounts.
- Message Content Intent and Presence Intent are privileged intents. For bots in fewer than 100 servers they are enabled with a single toggle.
- The bot only stores server ID, user IDs/usernames, staff IDs, reasons and timestamps of staff actions (cases/notes), plus snippets, tickets, giveaways and settings.
  Tell your staff that this data is stored, and delete it on request (`!delcase`, or remove the documents in MongoDB).
- `ALLOWED_GUILD_IDS` makes the bot leave any server that is not yours.
- The `dm` command sends one message to one member. Do not use it for mass messaging.

---

## Security

- Never commit `.env`. Never paste tokens, connection strings or cookies into chats or public repositories.
- If a token or password was ever shared publicly, rotate it immediately (Developer Portal -> Bot -> Reset Token, and change the MongoDB user password).

---

## License

Released under the **APRILIOV Use-Only License** - Copyright (c) 2026 APRILIOV. All rights reserved. See the [LICENSE](LICENSE) file for the full terms.

- **Allowed:** use the bot and configure it through its settings (`.env` and the in-app commands).
- **Not allowed:** modifying the code, selling or renting it (or access to it), and sharing or redistributing it.
- The copyright and license notice must stay intact.

The software is provided "as is", without warranty of any kind. The license notice is also shown in the console every time the bot starts.
