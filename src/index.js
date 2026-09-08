import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { db } from './database/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------
// 1. Lightweight Express Server for Render Free Tier Keep-Alive
// ---------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: 'Elder Discord Bot',
    message: 'Elder Discord Bot is running on Render!',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    clientReady: client.isReady(),
    databaseMode: db.mode,
    uptime: process.uptime()
  });
});

const server = app.listen(PORT, () => {
  console.log(`[RENDER WEB SERVICE] HTTP keep-alive server listening on port ${PORT}`);
});

// ---------------------------------------------------------
// 2. Initialize Discord Client with Gateway Intents & Partials
// ---------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User
  ]
});

client.commands = new Collection();

// ---------------------------------------------------------
// 3. Load Commands Recursively
// ---------------------------------------------------------
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
  const commandFolders = fs.readdirSync(foldersPath);
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    if (fs.lstatSync(commandsPath).isDirectory()) {
      const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(`file://${filePath}`);
        if ('data' in command && 'execute' in command) {
          client.commands.set(command.data.name, command);
          console.log(`[LOADED COMMAND] /${command.data.name} (${folder})`);
        } else {
          console.warn(`[WARNING] The command at ${filePath} is missing "data" or "execute".`);
        }
      }
    }
  }
}

// ---------------------------------------------------------
// 4. Load Events Dynamically
// ---------------------------------------------------------
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = await import(`file://${filePath}`);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[LOADED EVENT] ${event.name}`);
  }
}

// ---------------------------------------------------------
// 5. Initialize Database & Login to Discord
// ---------------------------------------------------------
async function startBot() {
  try {
    await db.init();
  } catch (dbErr) {
    console.error('[DATABASE INIT ERROR]', dbErr.message);
  }

  const token = process.env.DISCORD_TOKEN;

  if (!token || token === 'your_bot_token_here') {
    console.warn('\n======================================================');
    console.warn('⚠️  DISCORD_TOKEN is missing or still using placeholder.');
    console.warn('1. Copy .env.example to .env');
    console.warn('2. Add your bot token from Discord Developer Portal');
    console.warn('======================================================\n');
  } else {
    client.login(token).catch(err => {
      console.error('[ERROR] Failed to login to Discord:', err.message);
    });
  }
}

startBot();

// ---------------------------------------------------------
// 6. Graceful Shutdown Handling
// ---------------------------------------------------------
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[HTTP] Express server closed.');
    client.destroy();
    console.log('[DISCORD] Client destroyed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
