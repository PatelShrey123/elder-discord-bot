import {
  Events,
  EmbedBuilder
} from 'discord.js';
import { pendingDMs } from './messageCreate.js';
import { deliverModmailToStaff } from '../services/modmailService.js';

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
      // Immediately acknowledge button to prevent Discord 3-second timeout!
      await interaction.deferUpdate().catch(() => {});

      let content = '';
      let attachments = [];

      const pending = pendingDMs.get(user.id);
      if (pending) {
        content = pending.content;
        attachments = pending.attachments || [];
      } else {
        // Fallback: extract directly from the confirmation embed
        const desc = interaction.message?.embeds[0]?.description || '';
        const match = desc.match(/> "([\s\S]*?)"/);
        content = match ? match[1] : (desc.includes('*(Attachment/File)*') ? '' : desc);
      }

      try {
        await deliverModmailToStaff(
          interaction.client,
          user,
          content,
          attachments
        );

        pendingDMs.delete(user.id);

        const successEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('✅ Modmail Delivered to Elder Staff')
          .setDescription('Your message has been sent to our staff team! A moderator will reply to you directly in this DM.')
          .setFooter({ text: 'Elder Clan Modmail Support' })
          .setTimestamp();

        return interaction.editReply({
          embeds: [successEmbed],
          components: []
        });
      } catch (err) {
        console.error('[CONFIRM MODMAIL ERROR]', err);
        return interaction.editReply({
          content: `❌ Error delivering modmail: ${err.message}`,
          components: []
        });
      }
    }

    // B. Cancel Modmail
    if (customId === 'btn_cancel_modmail') {
      await interaction.deferUpdate().catch(() => {});
      pendingDMs.delete(user.id);
      return interaction.editReply({
        content: '❌ **Modmail cancelled.** Nothing was sent to staff.',
        embeds: [],
        components: []
      });
    }
  }
}
