import { Events, ActivityType } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export function execute(client) {
  console.log(`[DISCORD] Successfully logged in as ${client.user.tag}!`);
  
  // Set rich presence
  client.user.setPresence({
    activities: [{ name: 'Render Hosting 🚀 | /help', type: ActivityType.Playing }],
    status: 'online',
  });
}
