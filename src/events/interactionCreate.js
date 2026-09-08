import {
  Events,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
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

  // 2. Handle Button Interactions (Tickets)
  if (interaction.isButton()) {
    const customId = interaction.customId;

    // A. Open Ticket Button
    if (customId === 'btn_create_ticket') {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const user = interaction.user;
      const ticketId = `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      // Setup permission overwrites
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
          ],
        }
      ];

      // If a staff role is specified in .env, add them
      if (process.env.STAFF_ROLE_ID && guild.roles.cache.has(process.env.STAFF_ROLE_ID)) {
        permissionOverwrites.push({
          id: process.env.STAFF_ROLE_ID,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
          ],
        });
      }

      try {
        const ticketChannel = await guild.channels.create({
          name: ticketId,
          type: ChannelType.GuildText,
          permissionOverwrites,
        });

        // Record in database
        await db.createTicket(ticketChannel.id, ticketId, user.id);

        // Send greeting in the new channel
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle(`🎫 Ticket: ${ticketId}`)
          .setDescription(
            `Hello ${user}, welcome to your support ticket!\n\n` +
            `Please state your request, clan application details, or question. A member of the **Elder Clan Staff** will be with you shortly.\n\n` +
            `Click the **Close Ticket** button below when you are finished.`
          )
          .setFooter({ text: 'Elder Clan Ticket System' })
          .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId('btn_close_ticket')
          .setLabel('Close Ticket')
          .setEmoji('🔒')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeButton);

        await ticketChannel.send({
          content: `${user} ${process.env.STAFF_ROLE_ID ? `<@&${process.env.STAFF_ROLE_ID}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [row]
        });

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

    // B. Close Ticket Button
    if (customId === 'btn_close_ticket') {
      await interaction.reply({
        content: '🔒 Ticket will be closed and deleted in **5 seconds**...',
      });

      await db.closeTicket(interaction.channel.id, interaction.user.tag || interaction.user.username);

      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket closed by user or staff');
        } catch (err) {
          console.error('[DELETE TICKET ERROR]', err);
        }
      }, 5000);
      return;
    }
  }
}
