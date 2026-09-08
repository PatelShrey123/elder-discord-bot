import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('echo')
  .setDescription('Repeats the message you provide')
  .addStringOption(option =>
    option.setName('message')
      .setDescription('The message to repeat')
      .setRequired(true)
  );

export async function execute(interaction) {
  const message = interaction.options.getString('message');
  await interaction.reply({ content: `🗣️ **You said:** ${message}` });
}
