import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Lists all available slash commands and bot info');

export async function execute(interaction) {
  const commands = interaction.client.commands;

  const commandList = Array.from(commands.values()).map(
    cmd => `**/${cmd.data.name}**: ${cmd.data.description}`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setColor(0x00ffaa)
    .setTitle('📖 Available Commands')
    .setDescription(commandList || 'No commands found.')
    .addFields(
      { name: 'Need Custom Commands?', value: 'You can add new commands in `src/commands/` and run `npm run deploy-commands`!' }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
