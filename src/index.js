import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from 'discord.js';
import { db } from './database/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------
// 1. Express Web Server & Ticket Tool Dashboard
// ---------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep-alive health checks for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    clientReady: client ? client.isReady() : false,
    databaseMode: db.mode,
    uptime: process.uptime()
  });
});

// Serve Ticket Tool Web Dashboard
app.get('/ticketsetup', (req, res) => {
  const dashboardPath = path.join(__dirname, 'web', 'dashboard.html');
  res.sendFile(dashboardPath);
});

app.get('/dashboard', (req, res) => {
  res.redirect('/ticketsetup');
});

app.get('/', (req, res) => {
  res.redirect('/ticketsetup');
});

// Helper to get active Guild
function getActiveGuild() {
  if (!client || !client.isReady()) return null;
  if (process.env.GUILD_ID && client.guilds.cache.has(process.env.GUILD_ID)) {
    return client.guilds.cache.get(process.env.GUILD_ID);
  }
  return client.guilds.cache.first() || null;
}

// API: Get Live Guild Channels, Categories, Roles, and Config
app.get('/api/guild-data', async (req, res) => {
  try {
    const guild = getActiveGuild();
    if (!guild) {
      return res.json({
        guild: { name: 'Elder Clan (Awaiting Discord Bot Connection)', memberCount: 679, icon: null },
        categories: [
          { id: 'cat-1', name: '[ 📥 | APPLICATION-CENTER | 📥 ]' }
        ],
        textChannels: [
          { id: 'ch-1', name: 'tickets' },
          { id: 'ch-2', name: 'ticket-logs' }
        ],
        roles: [
          { id: 'r-1', name: '[ 👑 ] ELDER LEADER' },
          { id: 'r-2', name: '[ 🏛️ ] ELDER FOUNDER' },
          { id: 'r-3', name: '[ 👮 ] ELDER OFFICER' },
          { id: 'r-4', name: '[ 💡 ] ELDER ADMIN' },
          { id: 'r-5', name: '[ 🎖️ ] ELDER CO LEADER' },
          { id: 'r-6', name: '[ 🛡️ ] ELDER STAFF' }
        ],
        config: await db.getTicketConfig('default')
      });
    }

    const categories = [];
    const textChannels = [];

    guild.channels.cache.forEach(ch => {
      if (ch.type === ChannelType.GuildCategory) {
        categories.push({ id: ch.id, name: ch.name });
      } else if (ch.type === ChannelType.GuildText) {
        textChannels.push({ id: ch.id, name: ch.name });
      }
    });

    const roles = [];
    guild.roles.cache.forEach(r => {
      if (r.name !== '@everyone') {
        roles.push({ id: r.id, name: r.name, color: r.hexColor });
      }
    });

    const config = await db.getTicketConfig(guild.id);

    res.json({
      guild: {
        id: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        icon: guild.iconURL({ dynamic: true })
      },
      categories,
      textChannels,
      roles,
      config
    });
  } catch (err) {
    console.error('[API GUILD DATA ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Save Ticket Configuration
app.post('/api/save-ticket-config', async (req, res) => {
  try {
    const guild = getActiveGuild();
    const guildId = guild ? guild.id : 'default';

    const updated = await db.setTicketConfig(guildId, req.body);
    res.json({ success: true, config: updated });
  } catch (err) {
    console.error('[API SAVE CONFIG ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Deploy Ticket Panel into Selected Channel
app.post('/api/deploy-ticket-panel', async (req, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });

    const guild = getActiveGuild();
    if (!guild) return res.status(500).json({ error: 'Bot is not yet connected to any Discord guild.' });

    const targetChannel = guild.channels.cache.get(channelId);
    if (!targetChannel) return res.status(404).json({ error: 'Selected channel not found in server.' });

    const config = await db.getTicketConfig(guild.id);

    const embed = new EmbedBuilder()
      .setColor(config.panelColor ? parseInt(config.panelColor.replace('#', ''), 16) : 0x5865f2)
      .setTitle(config.panelTitle || '📩 Elder Clan Applications & Support')
      .setDescription(config.panelDescription || 'Click the button below to open a private ticket with our staff!')
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .setFooter({ text: 'Elder Clan Ticket Tool • 24/7 Automated' });

    const button = new ButtonBuilder()
      .setCustomId('btn_create_ticket')
      .setLabel(config.buttonText || 'Open Ticket')
      .setEmoji(config.buttonEmoji || '📩')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await targetChannel.send({ embeds: [embed], components: [row] });
    await db.setTicketConfig(guild.id, { panelChannelId: channelId });

    res.json({ success: true, channel: targetChannel.name });
  } catch (err) {
    console.error('[API DEPLOY PANEL ERROR]', err);
    res.status(500).json({ error: err.message });
  }
});

// Discord OAuth2 Login Redirect
app.get('/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const host = req.get('host');
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const redirectUri = encodeURIComponent(`${protocol}://${host}/auth/discord/callback`);
  const authorizeUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds%20guilds.members.read`;
  res.redirect(authorizeUrl);
});

// Discord OAuth2 Callback
app.get('/auth/discord/callback', async (req, res) => {
  // If user completes OAuth flow, redirect to /ticketsetup
  res.redirect('/ticketsetup?auth=success');
});

const server = app.listen(PORT, () => {
  console.log(`[RENDER WEB SERVICE] Ticket Tool & Dashboard listening on port ${PORT}`);
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
// 3. Load Commands & Events
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
