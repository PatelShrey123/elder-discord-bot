import {
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} from 'discord.js';
import { db } from '../database/db.js';

export const name = Events.InteractionCreate;

export async function execute(interaction) {
  // 1. Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command ${interaction.commandName}:`, error);
      const errorMessage = {
        content: '❌ There was an error executing this command!',
        ephemeral: true,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
    return;
  }

  // 2. Handle Button Interactions (Ticket Tool Suite)
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const guild = interaction.guild;
    const user = interaction.user;

    if (!guild) return;

    const config = await db.getTicketConfig(guild.id);

    // A. OPEN TICKET
    if (customId === 'btn_create_ticket') {
      await interaction.deferReply({ ephemeral: true });

      const ticketNumber = Math.floor(1000 + Math.random() * 9000);
      const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
      const channelName = `ticket-${cleanUsername}-${ticketNumber}`;

      // Build permission overwrites
      const permissionOverwrites = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
        {
          id: interaction.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
          ],
        }
      ];

      // Add all configured support roles
      const supportRoles = config.supportRoles || [];
      // Also include process.env.STAFF_ROLE_ID if present
      if (process.env.STAFF_ROLE_ID && !supportRoles.includes(process.env.STAFF_ROLE_ID)) {
        supportRoles.push(process.env.STAFF_ROLE_ID);
      }

      for (const roleId of supportRoles) {
        if (guild.roles.cache.has(roleId)) {
          permissionOverwrites.push({
            id: roleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          });
        }
      }

      try {
        const createOptions = {
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites,
        };

        // Attach to category if configured
        if (config.categoryId && guild.channels.cache.has(config.categoryId)) {
          createOptions.parent = config.categoryId;
        }

        const ticketChannel = await guild.channels.create(createOptions);

        // Record in database
        await db.createTicket(ticketChannel.id, channelName, user.id, config.categoryId);

        // Build welcome embed
        const welcomeText = (config.ticketMessage || 'Hello {user}! Welcome to your support ticket.')
          .replace('{user}', `<@${user.id}>`);

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🎫 ${channelName.toUpperCase()}`)
          .setDescription(`${welcomeText}\n\nOur staff team will assist you shortly.`)
          .addFields(
            { name: 'Opened By', value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
            { name: 'Status', value: '🟢 Open / Unclaimed', inline: true }
          )
          .setFooter({ text: 'Elder Ticket Tool • Use buttons below to manage' })
          .setTimestamp();

        const btnClose = new ButtonBuilder()
          .setCustomId('btn_close_ticket')
          .setLabel('Close')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger);

        const btnClaim = new ButtonBuilder()
          .setCustomId('btn_claim_ticket')
          .setLabel('Claim')
          .setEmoji('🙋')
          .setStyle(ButtonStyle.Success);

        const btnTranscript = new ButtonBuilder()
          .setCustomId('btn_transcript_ticket')
          .setLabel('Transcript')
          .setEmoji('📋')
          .setStyle(ButtonStyle.Secondary);

        const actionRow = new ActionRowBuilder().addComponents(btnClose, btnClaim, btnTranscript);

        const roleMentions = supportRoles.map(r => `<@&${r}>`).join(' ');

        await ticketChannel.send({
          content: `${user} ${roleMentions}`,
          embeds: [welcomeEmbed],
          components: [actionRow]
        });

        // If logging channel is set, log creation
        if (config.loggingChannelId && guild.channels.cache.has(config.loggingChannelId)) {
          const logChannel = guild.channels.cache.get(config.loggingChannelId);
          const logEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('📥 Ticket Created')
            .setDescription(`Ticket ${ticketChannel} created by ${user} (\`${user.id}\`).`)
            .setTimestamp();
          await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
        }

        await interaction.editReply({
          content: `✅ Your ticket has been created: ${ticketChannel}`,
        });
      } catch (err) {
        console.error('[CREATE TICKET ERROR]', err);
        await interaction.editReply({
          content: `❌ Could not create ticket channel: ${err.message}`,
        });
      }
      return;
    }

    // B. CLAIM TICKET
    if (customId === 'btn_claim_ticket') {
      const ticket = await db.getTicket(interaction.channel.id);
      if (!ticket) {
        return interaction.reply({ content: '❌ This channel is not an active ticket.', ephemeral: true });
      }

      await db.claimTicket(interaction.channel.id, user.tag || user.username);

      const claimEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setDescription(`🙋 **${user} has claimed this ticket!** They will be handling your request.`);

      await interaction.reply({ embeds: [claimEmbed] });
      return;
    }

    // C. TRANSCRIPT
    if (customId === 'btn_transcript_ticket') {
      await interaction.deferReply({ ephemeral: true });
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const transcriptLines = Array.from(messages.values()).reverse().map(m => {
        const time = m.createdAt.toISOString().replace('T', ' ').substring(0, 19);
        return `[${time}] ${m.author.tag}: ${m.content || (m.attachments.size ? '[Attachment]' : '')}`;
      }).join('\n');

      const buffer = Buffer.from(transcriptLines, 'utf-8');
      const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

      await interaction.editReply({
        content: `📄 Here is the transcript for **${interaction.channel.name}**:`,
        files: [attachment]
      });
      return;
    }

    // D. CLOSE TICKET
    if (customId === 'btn_close_ticket') {
      await interaction.reply({
        content: '🔒 Ticket closing in **5 seconds**... Generating transcript and logging.',
      });

      const channel = interaction.channel;
      const closedBy = `${user.tag || user.username} (${user.id})`;

      // Fetch transcript
      let transcriptAttachment = null;
      try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const transcriptLines = Array.from(messages.values()).reverse().map(m => {
          const time = m.createdAt.toISOString().replace('T', ' ').substring(0, 19);
          return `[${time}] ${m.author.tag}: ${m.content || (m.attachments.size ? '[Attachment]' : '')}`;
        }).join('\n');
        const buffer = Buffer.from(transcriptLines, 'utf-8');
        transcriptAttachment = new AttachmentBuilder(buffer, { name: `transcript-${channel.name}.txt` });
      } catch (e) {
        // ignore
      }

      await db.closeTicket(channel.id, closedBy);

      // Send to log channel if configured
      if (config.loggingChannelId && guild.channels.cache.has(config.loggingChannelId)) {
        const logChannel = guild.channels.cache.get(config.loggingChannelId);
        const logEmbed = new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle('🔒 Ticket Closed & Deleted')
          .addFields(
            { name: 'Ticket Name', value: `\`${channel.name}\``, inline: true },
            { name: 'Closed By', value: `${user} (\`${user.id}\`)`, inline: true }
          )
          .setTimestamp();

        await logChannel.send({
          embeds: [logEmbed],
          files: transcriptAttachment ? [transcriptAttachment] : []
        }).catch(() => {});
      }

      setTimeout(async () => {
        try {
          await channel.delete(`Closed by ${user.tag}`);
        } catch (err) {
          console.error('[DELETE TICKET ERROR]', err);
        }
      }, 5000);
      return;
    }
  }
}
