import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily Elder Points reward!');

export async function execute(interaction) {
  const result = await db.claimDaily(
    interaction.user.id,
    interaction.user.tag || interaction.user.username,
    100 // 100 Elder Points daily reward
  );

  if (!result.success) {
    const hours = Math.floor(result.remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((result.remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('⏳ Daily Already Claimed')
      .setDescription(`You have already claimed your daily Elder Points!\nPlease wait **${hours}h ${minutes}m** before claiming again.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🎁 Daily Elder Points Claimed!')
    .setDescription(`You received **+${result.rewardAmount}** Elder Points!`)
    .addFields(
      { name: 'Total Balance', value: `🪙 **${result.points.toLocaleString()}** Elder Points` }
    )
    .setFooter({ text: 'Come back tomorrow for your next reward!' })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
