import { Events, EmbedBuilder } from 'discord.js';
import { pendingDMs } from './messageCreate.js';
import { db } from '../database/db.js';

export const name = Events.MessageReactionAdd;

export async function execute(reaction, user) {
  // Ignore reactions by bots
  if (user.bot) return;

  // Only handle checkmark reaction
  if (reaction.emoji.name !== '✅') return;

  // Check if this user has a pending DM
  const pending = pendingDMs.get(user.id);
  if (!pending) return;

  try {
    const client = reaction.client;
    const staffChannel = await client.channels.fetch(pending.targetChannelId);

    if (!staffChannel) return;

    // Forward to staff
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

    if (pending.attachments && pending.attachments.length > 0) {
      const urls = pending.attachments.map(a => a.url).join('\n');
      staffEmbed.addFields({ name: 'Attachments', value: urls });
      const firstImg = pending.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
      if (firstImg) staffEmbed.setImage(firstImg.url);
    }

    await staffChannel.send({ embeds: [staffEmbed] });
    await db.setModmail(user.id, staffChannel.id);
    pendingDMs.delete(user.id);

    const successEmbed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Modmail Delivered to Elder Staff')
      .setDescription('Your message has been sent to our staff team! A moderator will reply to you directly in this DM.')
      .setFooter({ text: 'Elder Clan Modmail Support' })
      .setTimestamp();

    await reaction.message.edit({
      embeds: [successEmbed],
      components: []
    }).catch(() => {});
  } catch (err) {
    console.error('[REACTION CONFIRM MODMAIL ERROR]', err);
  }
}
