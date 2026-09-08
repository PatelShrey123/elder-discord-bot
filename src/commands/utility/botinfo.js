import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botinfo')
  .setDescription('Shows technical information and uptime of the bot');

export async function execute(interaction) {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  const uptimeFormatted = `${hours}h ${minutes}m ${seconds}s`;

  const memoryUsageMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🤖 ${interaction.client.user.username} Status`)
    .addFields(
      { name: 'Uptime', value: `\`${uptimeFormatted}\``, inline: true },
      { name: 'Memory Usage', value: `\`${memoryUsageMB} MB\``, inline: true },
      { name: 'Ping', value: `\`${interaction.client.ws.ping} ms\``, inline: true },
      { name: 'Node.js Version', value: `\`${process.version}\``, inline: true },
      { name: 'Hosting Platform', value: 'Render Web Service', inline: true },
      { name: 'Guilds Active', value: `\`${interaction.client.guilds.cache.size}\``, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: 'Hosted on Render 🚀' });

  await interaction.reply({ embeds: [embed] });
}
