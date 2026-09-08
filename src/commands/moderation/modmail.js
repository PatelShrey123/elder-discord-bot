import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';

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
      .setDescription('Staff: Close an active modmail ticket')
      .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
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

    // Find the configured modmail channel
    const channelId = await db.getModmailChannel(interaction.guild.id);
    const staffChannel = channelId ? interaction.guild.channels.cache.get(channelId) : null;

    if (!staffChannel) {
      return interaction.reply({
        content: 'ℹ️ The Modmail inbox channel is not yet configured on this server. A staff member needs to run `/modmail-setup <channel>`.',
        ephemeral: true
      });
    }

    // If member provided a message directly in the slash command
    if (userMessage) {
      const staffEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: `${user.tag} (${user.id})`,
          iconURL: user.displayAvatarURL({ dynamic: true })
        })
        .setTitle('📬 Incoming Modmail')
        .setDescription(userMessage)
        .setFooter({ text: `User ID: ${user.id} • Use Discord Reply on this message to respond` })
        .setTimestamp();

      try {
        await staffChannel.send({ embeds: [staffEmbed] });
        await db.setModmail(user.id, staffChannel.id);

        // Send copy to user DMs
        const userConfirmEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Modmail Delivered to Elder Staff')
          .setDescription(`Your message has been sent to our staff team:\n> ${userMessage}\n\nA moderator will reply to you directly in this DM.`)
          .setFooter({ text: 'Elder Clan Modmail Support' })
          .setTimestamp();

        await user.send({ embeds: [userConfirmEmbed] }).catch(() => {});

        return interaction.reply({
          content: '✅ **Your Modmail has been sent to the Elder Staff Team!** Staff will reply to you in your DMs.',
          ephemeral: true
        });
      } catch (err) {
        console.error('[MODMAIL SEND ERROR]', err);
        return interaction.reply({
          content: '❌ Failed to deliver message to staff. Please try again.',
          ephemeral: true
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

  const targetUser = interaction.options.getUser('user');

  // 2. STAFF: REPLY
  if (subcommand === 'reply') {
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
