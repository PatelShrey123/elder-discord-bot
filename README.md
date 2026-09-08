# 🤖 Render Discord Bot

A production-ready Discord bot template built with **Discord.js v14** and configured for **free 24/7 hosting on Render**.

---

## 🚀 Features

- **Discord.js v14**: Fully compatible with latest Gateway intents and slash commands.
- **Embedded Express Keep-Alive**: Includes an HTTP health check server (`/` and `/health`) so it runs as a **Free Web Service** on Render without needing paid background workers.
- **Dynamic Command & Event Loader**: Automatically loads commands from `src/commands/` and events from `src/events/`.
- **Preconfigured Render Blueprint**: Includes `render.yaml` for 1-click deployment.

---

## 🛠️ Step 1: Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and click **"New Application"**.
2. Give your bot a name and click **Create**.
3. Go to the **"Bot"** tab on the left:
   - Click **"Reset Token"** and copy your **Bot Token**. Save this for your `.env` and Render!
   - Scroll down to **Privileged Gateway Intents** and enable:
     - ✅ **Message Content Intent**
     - ✅ **Server Members Intent** (if your bot handles member joins)
4. Go to the **"OAuth2"** tab:
   - Copy your **Client ID** (Application ID).
   - Under **OAuth2 URL Generator**:
     - Scopes: Select `bot` and `applications.commands`.
     - Bot Permissions: Select `Administrator` (or specific permissions like `Send Messages`, `Embed Links`, etc.).
     - Copy the generated URL at the bottom and paste it into your browser to invite the bot to your Discord server!

---

## 💻 Step 2: Local Setup

1. Clone or open this folder in your terminal:
   ```bash
   cd render-discord-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in:
   - `DISCORD_TOKEN`: Your bot token from Step 1.
   - `CLIENT_ID`: Your bot Client ID from Step 1.
   - `GUILD_ID`: (Optional) Your Discord server ID for instant test-command sync.

4. Register slash commands:
   ```bash
   npm run deploy-commands
   ```

5. Start the bot locally:
   ```bash
   npm start
   ```
   You should see:
   - `[RENDER WEB SERVICE] HTTP health check server listening on port 3000`
   - `[DISCORD] Successfully logged in as YourBot#1234!`

---

## ☁️ Step 3: Deploying to Render (Free Tier)

### 1. Push your code to GitHub
Create a new GitHub repository and push this code:
```bash
git init
git add .
git commit -m "Initial Discord bot setup"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### 2. Create the Web Service on Render
1. Log in to [Render.com](https://dashboard.render.com).
2. Click **"New +"** -> **"Web Service"**.
3. Connect your GitHub repository.
4. Fill in the settings:
   - **Name**: `my-discord-bot` (or any name)
   - **Region**: Closest to you (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Under **Environment Variables**, add:
   - `DISCORD_TOKEN` = `your_actual_bot_token`
   - `CLIENT_ID` = `your_application_client_id`
   - `PORT` = `10000`
6. Click **"Create Web Service"**.

---

## ⏰ Step 4: Keep Alive 24/7 (Prevent Render Sleeping)

Render free web services automatically sleep after 15 minutes of HTTP inactivity.

To keep your Discord bot online 24/7:
1. Copy your Render web service URL (e.g. `https://my-discord-bot.onrender.com`).
2. Go to a free monitoring service like [UptimeRobot](https://uptimerobot.com) or [cron-job.org](https://cron-job.org).
3. Create a **New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **URL**: `https://my-discord-bot.onrender.com/health`
   - **Monitoring Interval**: Every 5 or 10 minutes.
4. That's it! Render will receive a ping every 5 minutes and keep your bot online 24/7 for free.
