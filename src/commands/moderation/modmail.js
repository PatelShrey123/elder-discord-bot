import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';
import { deliverModmailToStaff } from '../../services/modmailService.js';

export const data = new SlashCommandBuilder()
  .setName('modmail')
  .setDescription('Elder Clan Modmail system (Contact staff or manage tickets)')
  .addSubcommand(sub =>
    sub.setName('send')
      .setDescription('Send a private message/report to the Elder Staff Team')
      .addStringOption(opt =>
        opt.setName('message')
          .setDescription('Your message, question, or report for staff')
      )
  )
  .addSubcommand(sub =>
    sub.setName('reply')
      .setDescription('Staff: Reply to a member who sent a Modmail')
      .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
      .addStringOption(opt => opt.setName('message').setDescription('Message to send').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('close')
      .setDescription('Staff: Close an active modmail ticket/thread')
      .addUserOption(opt => opt.setName('user').setDescription('Target member (optional if inside ticket thread)'))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for closing'))
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  // ==========================================
  // 1. MEMBER: SEND MODMAIL (/modmail send)
  // ==========================================
  if (subcommand === 'send') {
    const userMessage = interaction.options.getString('message');
    const user = interaction.user;

    // If member provided a message directly in the slash command
    if (userMessage) {
      await interaction.deferReply({ ephemeral: true });

      try {
        await deliverModmailToStaff(
          interaction.client,
          user,
          userMessage,
          []
        );

        // Send confirmation copy to user DMs
        const userConfirmEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Modmail Delivered to Elder Staff')
          .setDescription(`Your message has been sent to our staff team:\n> ${userMessage}\n\nA moderator will reply to you directly in this DM.`)
          .setFooter({ text: 'Elder Clan Modmail Support' })
          .setTimestamp();

        await user.send({ embeds: [userConfirmEmbed] }).catch(() => {});

        return interaction.editReply({
          content: '✅ **Your Modmail has been sent to the Elder Staff Team!** Staff will reply to you directly in your DMs.',
        });
      } catch (err) {
        console.error('[MODMAIL SEND ERROR]', err);
        return interaction.editReply({
          content: `❌ Could not deliver message: ${err.message}`,
        });
      }
    }

    // If no message was passed in the command, prompt them in DMs
    try {
      const dmPrompt = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📬 Elder Clan Modmail')
        .setDescription(
          `👋 Hello **${user.username}**!\n\n` +
          `Please reply to this DM with your message, report, or question for the **Elder Staff Team**.\n\n` +
          `*(You will be asked to confirm before your message is sent to staff!)*`
        )
        .setFooter({ text: 'Elder Clan Modmail Support' })
        .setTimestamp();

      await user.send({ embeds: [dmPrompt] });

      return interaction.reply({
        content: '📬 **I have sent you a DM!** Please check your private messages to type your message to staff.',
        ephemeral: true
      });
    } catch (dmErr) {
      return interaction.reply({
        content: '❌ Could not send you a DM. Please enable **"Allow direct messages from server members"** in your Discord Privacy Settings, or use `/modmail send message:<your text>`.',
        ephemeral: true
      });
    }
  }

  // ==========================================
  // STAFF COMMANDS: Require ManageMessages
  // ==========================================
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return interaction.reply({
      content: '❌ You do not have permission to use staff modmail commands.',
      ephemeral: true
    });
  }

  // 2. STAFF: REPLY
  if (subcommand === 'reply') {
    const targetUser = interaction.options.getUser('user');
    const replyText = interaction.options.getString('message');

    const dmEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
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

  // 3. STAFF: CLOSE
  if (subcommand === 'close') {
    let targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'Ticket resolved';

    // If user not provided, check if command is being run inside the user's thread
    if (!targetUser && interaction.channel.isThread()) {
      const threadUserId = await db.getUserByThread(interaction.channel.id);
      if (threadUserId) {
        try {
          targetUser = await interaction.client.users.fetch(threadUserId);
        } catch (e) {}
      }
    }

    if (!targetUser) {
      return interaction.reply({
        content: '❌ Please specify the user to close, or run `/modmail close` inside their active ticket thread.',
        ephemeral: true
      });
    }

    await db.closeModmail(targetUser.id);

    const closeDmEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🔒 Modmail Ticket Closed')
      .setDescription(`Your support ticket with **${interaction.guild.name}** has been closed by staff.\n**Reason:** ${reason}`)
      .setFooter({ text: 'You can send a new DM or use /modmail anytime if you need assistance again.' })
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [closeDmEmbed] });
    } catch {
      // DMs closed, ignore
    }

    // If run inside thread, archive thread
    if (interaction.channel.isThread()) {
      await interaction.reply({ content: `✅ Ticket with ${targetUser} closed. Archiving thread...` });
      setTimeout(async () => {
        try {
          await interaction.channel.setLocked(true);
          await interaction.channel.setArchived(true);
        } catch (e) {}
      }, 2000);
      return;
    }

    return interaction.reply({ content: `✅ Modmail ticket with ${targetUser} has been closed.` });
  }
}
