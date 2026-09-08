import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with Pong and displays bot latency!');

export async function execute(interaction) {
  const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
  const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
  const wsLatency = interaction.client.ws.ping;

  await interaction.editReply(
    `🏓 **Pong!**\n` +
    `• Roundtrip Latency: \`${roundtripLatency}ms\`\n` +
    `• WebSocket Heartbeat: \`${wsLatency}ms\``
  );
}
