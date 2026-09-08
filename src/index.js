import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials
} from 'discord.js';
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
    message: 'Elder Discord Bot is running 24/7 on Render!',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    clientReady: client ? client.isReady() : false,
    databaseMode: db.mode,
    uptime: process.uptime()
  });
});

const server = app.listen(PORT, () => {
  console.log(`[RENDER WEB SERVICE] HTTP keep-alive server listening on port ${PORT}`);
});

// ---------------------------------------------------------
// 2. Client Creation Helper
// ---------------------------------------------------------
function createClient(usePrivileged = true) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ];

  if (usePrivileged) {
    intents.push(GatewayIntentBits.GuildMembers);
    intents.push(GatewayIntentBits.MessageContent);
  }

  const newClient = new Client({
    intents,
    partials: [
      Partials.Channel,
      Partials.Message,
      Partials.User
    ]
  });

  newClient.commands = new Collection();
  loadCommandsAndEvents(newClient);
  return newClient;
}

// ---------------------------------------------------------
// 3. Load Commands & Events Dynamically
// ---------------------------------------------------------
function loadCommandsAndEvents(targetClient) {
  // Commands
  const foldersPath = path.join(__dirname, 'commands');
  if (fs.existsSync(foldersPath)) {
    const commandFolders = fs.readdirSync(foldersPath);
    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      if (fs.lstatSync(commandsPath).isDirectory()) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
          const filePath = path.join(commandsPath, file);
          import(`file://${filePath}`).then(command => {
            if ('data' in command && 'execute' in command) {
              targetClient.commands.set(command.data.name, command);
              console.log(`[LOADED COMMAND] /${command.data.name} (${folder})`);
            }
          }).catch(err => {
            console.error(`[COMMAND LOAD ERROR] ${filePath}:`, err.message);
          });
        }
      }
    }
  }

  // Events
  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      import(`file://${filePath}`).then(event => {
        if (event.once) {
          targetClient.once(event.name, (...args) => event.execute(...args));
        } else {
          targetClient.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`[LOADED EVENT] ${event.name}`);
      }).catch(err => {
        console.error(`[EVENT LOAD ERROR] ${filePath}:`, err.message);
      });
    }
  }
}

let client = createClient(true);

// ---------------------------------------------------------
// 4. Initialize Database & Login to Discord
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
    return;
  }

  try {
    await client.login(token);
  } catch (err) {
    if (err.message.includes('disallowed intents')) {
      console.warn('\n⚠️  [GATEWAY INTENTS] Discord Privileged Intents not toggled on.');
      console.warn('🔄 Switching to Standard Intents seamlessly...\n');

      client.destroy();
      client = createClient(false);
      await client.login(token);
    } else {
      console.error('[LOGIN ERROR]', err.message);
    }
  }
}

startBot();

// ---------------------------------------------------------
// 5. Graceful Shutdown Handling
// ---------------------------------------------------------
function handleShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[HTTP] Express server closed.');
    if (client) client.destroy();
    console.log('[DISCORD] Client destroyed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
