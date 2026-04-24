# NM x Lemonxdop

Discord bot + selfbot autocatcher stack for Pokétwo-style workflows. It includes slash/prefix control commands, a local web dashboard, and optional AI-assisted catching.

## Requirements

- [Node.js](https://nodejs.org/) 18+ recommended
- npm

## Setup

1. Clone or copy this folder.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Edit **`config.js`**:

   - `botToken` — your **bot** application token (Discord Developer Portal).
   - `prefix` — prefix for text commands (default `.`).
   - `owners` — array of Discord user IDs allowed to run admin commands.
   - `aiCatch`, `aiHostname`, `aiApiKey` — AI prediction service (if used).
   - `captchaSolveUrl`, `captchaLicenseKey` — external captcha solver (if used).
   - Webhooks under `captchaHook`, `logHook`, `questHook`, `rarityHook`, etc. — optional logging.
   - **Dashboard:** `dashboardPort`, `dashboardUser`, `dashboardPass`.

4. Add user account tokens (selfbot) to **`data/tokens.txt`** — **one token per line**.  
   The bot reads only this file for stored tokens.

5. Start:

   ```bash
   node index
   ```

   On first run the bot registers slash commands for the application tied to `botToken`.

## Web dashboard

While the process is running, open:

`http://localhost:<dashboardPort>`

(default port from `config.js`, or override with env `DASHBOARD_PORT`).

- Log in with `dashboardUser` / `dashboardPass`.
- Start/stop autocatchers, manage tokens (including multi-line paste), toggle AI catch, edit selected `config.js` fields, and view a live catch log and aggregate stats (where available).

## Commands

- **Slash:** `/help` in Discord lists slash commands (also see `slashCommands.js`).
- **Prefix:** `<prefix>help` (e.g. `.help`) lists prefix commands and points here.

Selfbot accounts respond to **`.`** commands in-channel when the author is in that account’s owner list; use `.owneradd <discord user id>` from an owned selfbot session to grant access.

## Project layout (high level)

| Path | Role |
|------|------|
| `index.js` | Main bot, interactions, prefix handler |
| `functions/catcher.js` | Selfbot client + catch logic |
| `functions/functions.js` | Tokens, start/stop, stats helpers |
| `dashboard/` | Express UI + API |
| `utils/api.js` | AI / captcha HTTP helpers |
| `data/tokens.txt` | Stored user tokens |

## Security notes

- Never commit real `config.js` values or `tokens.txt` to a public repo.
- The dashboard is bound to `0.0.0.0` by default; use a firewall or reverse proxy if the host is reachable from other machines.
- Selfbot usage may violate Discord’s Terms of Service; use at your own risk.

## License

No license file is included; treat as private / all rights reserved unless you add one.
