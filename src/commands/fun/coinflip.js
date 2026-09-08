import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('coinflip')
  .setDescription('Flip a coin (Heads or Tails)');

export async function execute(interaction) {
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const emoji = result === 'Heads' ? '🪙' : '🪙';

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`${emoji} Coin Flip Result`)
    .setDescription(`The coin landed on **${result}**!`)
    .setFooter({ text: `Flipped by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
