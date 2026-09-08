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

## 🗄️ Supabase Cloud Database Setup

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** on the left menu.
3. Paste the following and click **RUN**:
```sql
CREATE TABLE IF NOT EXISTS elder_points (
  user_id TEXT PRIMARY KEY,
  username TEXT,
  points BIGINT DEFAULT 0,
  last_daily TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS blacklist (
  target_id TEXT PRIMARY KEY,
  target_tag TEXT,
  reason TEXT,
  proof TEXT,
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modmail (
  user_id TEXT PRIMARY KEY,
  thread_id TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE elder_points DISABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE modmail DISABLE ROW LEVEL SECURITY;
```
4. Copy your **Project URL** (`SUPABASE_URL`) and **anon key** (`SUPABASE_KEY`) into your environment variables.

---

## 🚀 Deploying 24/7 on Render (Free Tier)

1. Connect your repository `PatelShrey123/elder-discord-bot` on [dashboard.render.com](https://dashboard.render.com).
2. Create as a **Free Web Service**.
3. Set environment variables:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `PORT` = `10000`
4. Use [UptimeRobot.com](https://uptimerobot.com) to ping `https://your-bot.onrender.com/health` every 5 minutes to keep it online 24/7!
