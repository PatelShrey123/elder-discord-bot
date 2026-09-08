import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('modmail')
  .setDescription('Modmail management and direct member messaging')
  .addSubcommand(sub =>
    sub.setName('reply')
      .setDescription('Reply to a member who opened a Modmail ticket')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('close')
      .setDescription('Close an active modmail ticket with a member')
      .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for closing'))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const targetUser = interaction.options.getUser('user');

  if (subcommand === 'reply') {
    const replyText = interaction.options.getString('message');

    const dmEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({
        name: `Elder Staff Team (${interaction.guild.name})`,
        iconURL: interaction.guild.iconURL({ dynamic: true })
      })
      .setDescription(replyText)
      .setFooter({ text: 'Reply to this DM to continue communicating with staff.' })
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });

      const confirmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📬 Modmail Reply Sent')
        .setDescription(`Sent reply to ${targetUser}:\n> ${replyText}`)
        .setFooter({ text: `Sent by ${interaction.user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [confirmEmbed] });
    } catch (err) {
      return interaction.reply({
        content: `❌ Could not send DM to ${targetUser}. Their DMs may be closed or blocked.`,
        ephemeral: true
      });
    }
  }

  if (subcommand === 'close') {
    const reason = interaction.options.getString('reason') || 'No reason provided';
    await db.closeModmail(targetUser.id);

    const closeDmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔒 Modmail Ticket Closed')
      .setDescription(`Your support ticket with **${interaction.guild.name}** has been closed by staff.\n**Reason:** ${reason}`)
      .setFooter({ text: 'You can send a new DM anytime if you need assistance again.' })
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [closeDmEmbed] });
    } catch {
      // DMs closed, ignore
    }

    return interaction.reply({ content: `✅ Modmail ticket with ${targetUser} has been closed.` });
  }
}
