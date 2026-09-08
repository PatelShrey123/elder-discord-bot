import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roll')
  .setDescription('Roll a random number between 1 and a specified maximum')
  .addIntegerOption(opt =>
    opt.setName('max')
      .setDescription('Maximum number (default: 100)')
      .setMinValue(2)
      .setMaxValue(1000000)
  );

export async function execute(interaction) {
  const max = interaction.options.getInteger('max') || 100;
  const result = Math.floor(Math.random() * max) + 1;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle('🎲 Dice Roll')
    .setDescription(`You rolled a **${result}** (1 - ${max})!`)
    .setFooter({ text: `Rolled by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
