# 🛡️ Elder Discord Bot

A complete clan and server management Discord bot built with **Discord.js v14**, configured for **24/7 free hosting on Render** and permanent cloud storage with **Supabase / PostgreSQL**.

---

## ⚡ Features

### 🪙 Elder Points Currency
- `/points balance [user]` — View Elder Points balance and clan rank.
- `/points add <user> <amount>` — Admin: Award points for scrims, clan wars, and events.
- `/points remove <user> <amount>` — Admin: Deduct points.
- `/points pay <user> <amount>` — Transfer points between members.
- `/points leaderboard` — Top 10 richest clan members.
- `/daily` — Claim 100 daily Elder Points (24-hour cooldown).

### 🚫 Clan Blacklist System (iWin Style)
- `/blacklist check <user_id_or_mention>` — Instant check if a player or clan applicant is blacklisted.
- `/blacklist add <user_id_or_mention> <reason> [proof]` — Record an offender into the database with reason & proof link.
- `/blacklist remove <user_id_or_mention>` — Remove a player from the blacklist.
- `/blacklist list` — View all blacklisted records.
- **Auto-Join Scanner**: Automatically alerts staff if a blacklisted ID joins the server!

### 🎟️ Interactive Ticket System
- `/ticket-setup <channel>` — Deploys a support & clan application panel with an **"📩 Open Ticket"** button.
- Creates private ticket channels (`#ticket-<user>-<id>`) visible only to the user and staff.
- Includes a **"🔒 Close Ticket"** button with a 5-second countdown and automatic cleanup.

### 📬 Modmail System
- Members can **Direct Message (DM)** the bot for private support.
- Inbound DMs and attachments are instantly forwarded to your configured staff modmail channel.
- Staff can reply using `/modmail reply user:<id> message:<text>` or close tickets with `/modmail close`.

### 📊 Google Sheets Roster Sync
- `/roster link` — Direct link to your clan's Google Sheet.
- `/roster view` — Fetches and displays live member rows from your published Google Sheet directly in Discord.

### 🎲 Fun & Clan Utility
- `/coinflip` — Flip a coin.
- `/roll [max]` — Roll dice (1-100 or custom).
- `/8ball <question>` — Ask the Magic 8-ball.
- `/purge <count>` — Bulk delete messages.
- `/ping` & `/botinfo` — Bot latency and uptime stats.

---

## 🗄️ Supabase Cloud Database Setup (1-Click)

1. Go to [database.new](https://database.new) or [supabase.com](https://supabase.com) and create a free project.
2. Open the **SQL Editor** on the left menu.
3. Paste the contents of [`src/database/supabase_schema.sql`](src/database/supabase_schema.sql) and click **RUN**.
4. Go to **Project Settings** > **API**:
   - Copy **Project URL** (put in `SUPABASE_URL`).
   - Copy **anon / publishable key** or **service_role key** (put in `SUPABASE_KEY`).

*(Note: The bot also includes a local JSON database fallback in `data/elder_data.json` if Supabase is not provided during local testing!)*

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
| :--- | :--- |
| `DISCORD_TOKEN` | Discord Bot Token from Developer Portal |
| `CLIENT_ID` | Application Client ID from Developer Portal |
| `GUILD_ID` | (Optional) Server ID for instant command updates |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_KEY` | Your Supabase API Key |
| `MODMAIL_CHANNEL_ID` | Staff channel ID for receiving Modmail DMs |
| `STAFF_ROLE_ID` | Moderator/Staff Role ID for ticket access |
| `GOOGLE_SHEET_URL` | Link to your Google Sheet roster |
| `GOOGLE_SHEET_CSV_URL` | Published CSV link (**File > Share > Publish to web > CSV**) |
| `PORT` | 3000 (Render uses 10000 automatically) |

---

## 🚀 Deploying 24/7 on Render (Free Tier)

### 1. Push code to GitHub
```bash
git add .
git commit -m "Add full Elder clan bot features: points, blacklist, tickets, modmail"
git push origin main
```

### 2. Create Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) > **New +** > **Web Service**.
2. Connect your GitHub repository `PatelShrey123/elder-discord-bot`.
3. Configure:
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free**
4. Under **Environment Variables**, add:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `MODMAIL_CHANNEL_ID` *(optional)*
   - `STAFF_ROLE_ID` *(optional)*
   - `PORT` = `10000`
5. Click **Create Web Service**.

### 3. Keep Alive 24/7 (Prevent Render Sleep)
1. Copy your Render URL (e.g., `https://elder-discord-bot.onrender.com`).
2. Go to [UptimeRobot.com](https://uptimerobot.com) (free account).
3. Add a monitor for:
   - **Type**: `HTTP(s)`
   - **URL**: `https://elder-discord-bot.onrender.com/health`
   - **Interval**: 5 minutes.
4. Your bot will remain online 24/7 for free!
