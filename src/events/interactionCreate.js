import {
  Events,
  EmbedBuilder
} from 'discord.js';
import { pendingDMs } from './messageCreate.js';
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

  // 2. Handle Modmail Confirmation Buttons (in DMs)
  if (interaction.isButton()) {
    const customId = interaction.customId;
    const user = interaction.user;

    // A. Confirm Send Modmail
    if (customId === 'btn_confirm_modmail') {
      const pending = pendingDMs.get(user.id);

      if (!pending) {
        return interaction.update({
          content: 'ℹ️ This modmail request has expired or was already sent.',
          embeds: [],
          components: []
        });
      }

      try {
        const staffChannel = await interaction.client.channels.fetch(pending.targetChannelId);

        if (!staffChannel) {
          return interaction.update({
            content: '❌ Could not reach the staff channel. Please try again later.',
            components: []
          });
        }

        // Build staff embed
        const staffEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setAuthor({
            name: `${user.tag} (${user.id})`,
            iconURL: user.displayAvatarURL({ dynamic: true })
          })
          .setTitle('📬 Incoming Modmail')
          .setDescription(pending.content || '*(No text provided)*')
          .setFooter({ text: `User ID: ${user.id} • Use Discord Reply on this message to respond` })
          .setTimestamp();

        // Attachments
        if (pending.attachments && pending.attachments.length > 0) {
          const urls = pending.attachments.map(a => a.url).join('\n');
          staffEmbed.addFields({ name: 'Attachments', value: urls });
          const firstImg = pending.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
          if (firstImg) staffEmbed.setImage(firstImg.url);
        }

        await staffChannel.send({ embeds: [staffEmbed] });

        // Save modmail state in db
        await db.setModmail(user.id, staffChannel.id);
        pendingDMs.delete(user.id);

        const successEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Modmail Delivered to Elder Staff')
          .setDescription('Your message has been sent to our staff team! A moderator will reply to you directly in this DM.')
          .setFooter({ text: 'Elder Clan Modmail Support' })
          .setTimestamp();

        return interaction.update({
          embeds: [successEmbed],
          components: []
        });
      } catch (err) {
        console.error('[CONFIRM MODMAIL ERROR]', err);
        return interaction.update({
          content: `❌ Error sending modmail: ${err.message}`,
          components: []
        });
      }
    }

    // B. Cancel Modmail
    if (customId === 'btn_cancel_modmail') {
      pendingDMs.delete(user.id);
      return interaction.update({
        content: '❌ **Modmail cancelled.** Nothing was sent to staff.',
        embeds: [],
        components: []
      });
    }
  }
}
