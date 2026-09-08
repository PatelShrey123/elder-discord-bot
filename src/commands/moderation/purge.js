import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk delete messages from this channel (Moderators only)')
  .addIntegerOption(opt =>
    opt.setName('amount')
      .setDescription('Number of messages to delete (1-100)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const amount = interaction.options.getInteger('amount');

  await interaction.deferReply({ ephemeral: true });

  try {
    const deleted = await interaction.channel.bulkDelete(amount, true);
    await interaction.editReply(`🧹 Successfully deleted **${deleted.size}** messages.`);
  } catch (error) {
    console.error('[PURGE ERROR]', error);
    await interaction.editReply('❌ Failed to purge messages. Note: Discord does not allow bulk-deleting messages older than 14 days.');
  }
}
