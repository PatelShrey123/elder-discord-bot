import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(`file://${filePath}`);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`[LOADED] Command: /${command.data.name}`);
    } else {
      console.warn(`[WARNING] The command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('[ERROR] DISCORD_TOKEN or CLIENT_ID is missing from environment variables (.env).');
  process.exit(1);
}

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    let data;
    if (guildId) {
      // Clear global commands to prevent duplicate entries showing in Discord
      await rest.put(Routes.applicationCommands(clientId), { body: [] });
      console.log('Cleared global commands to prevent duplicates.');

      // Guild-specific registration (instant updates)
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log(`Successfully reloaded ${data.length} guild (/) commands for guild: ${guildId}.`);
    } else {
      // Global registration (takes a few minutes to propagate across all Discord servers)
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      );
      console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error('[ERROR] Failed to register commands:', error);
  }
})();
