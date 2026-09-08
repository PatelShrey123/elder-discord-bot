import { Events, EmbedBuilder } from 'discord.js';
import { db } from '../database/db.js';

export const name = Events.MessageCreate;

export async function execute(message) {
  // Ignore bots
  if (message.author.bot) return;

  // Check if the message is a Direct Message (DM)
  if (!message.guild) {
    const modmailChannelId = process.env.MODMAIL_CHANNEL_ID;

    if (!modmailChannelId) {
      return message.reply('ℹ️ Modmail is currently disabled or awaiting staff channel configuration.');
    }

    try {
      const channel = await message.client.channels.fetch(modmailChannelId);
      if (!channel) {
        console.error('[MODMAIL] Could not find configured modmail channel:', modmailChannelId);
        return;
      }

      // Build embed for staff
      const staffEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setAuthor({
          name: `${message.author.tag} (${message.author.id})`,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTitle('📬 Incoming Modmail Message')
        .setDescription(message.content || '*(No text provided)*')
        .setFooter({ text: `To reply, use /modmail reply user:${message.author.id} message:...` })
        .setTimestamp();

      // If user sent attachments (images, proofs)
      if (message.attachments.size > 0) {
        const attachmentUrls = message.attachments.map(a => a.url).join('\n');
        staffEmbed.addFields({ name: 'Attachments', value: attachmentUrls });
        const firstImage = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
        if (firstImage) staffEmbed.setImage(firstImage.url);
      }

      await channel.send({ embeds: [staffEmbed] });

      // Save modmail record
      await db.setModmail(message.author.id, channel.id);

      // Confirm to the user in DMs
      const userConfirmEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('📬 Message Delivered to Elder Staff')
        .setDescription('Thank you! Your message has been forwarded to the **Elder Clan Staff**.\nA moderator will reply to you directly in this DM.')
        .setFooter({ text: 'Elder Clan Modmail System' })
        .setTimestamp();

      await message.reply({ embeds: [userConfirmEmbed] });
    } catch (err) {
      console.error('[MODMAIL FORWARD ERROR]', err);
    }
  }
}
