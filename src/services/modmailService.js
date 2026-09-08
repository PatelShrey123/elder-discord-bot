import { EmbedBuilder } from 'discord.js';
import { db } from '../database/db.js';

export async function deliverModmailToStaff(client, user, content, attachments = []) {
  // 1. Locate the configured staff Modmail channel
  let targetChannel = null;
  const configuredId = process.env.MODMAIL_CHANNEL_ID;

  if (configuredId) {
    try {
      targetChannel = await client.channels.fetch(configuredId);
    } catch (e) {}
  }

  if (!targetChannel) {
    for (const [, guild] of client.guilds.cache) {
      const chId = await db.getModmailChannel(guild.id);
      if (chId && guild.channels.cache.has(chId)) {
        targetChannel = guild.channels.cache.get(chId);
        break;
      }
    }
  }

  if (!targetChannel) {
    throw new Error('No staff Modmail channel has been configured yet. Staff must run /modmail-setup <channel>.');
  }

  // 2. Check for an existing open thread for this user
  let thread = null;
  const existingRecord = await db.getModmail(user.id);

  if (existingRecord && existingRecord.threadId) {
    try {
      thread = await client.channels.fetch(existingRecord.threadId);
      if (thread && thread.archived) {
        await thread.setArchived(false);
      }
    } catch (e) {
      thread = null;
    }
  }

  let isNewThread = false;

  // 3. If no active thread exists, create a dedicated thread in the Modmail channel
  if (!thread) {
    isNewThread = true;
    const cleanUsername = user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'member';
    const threadName = `🧵-ticket-${cleanUsername}`;

    thread = await targetChannel.threads.create({
      name: threadName,
      autoArchiveDuration: 1440, // 24 hours
      reason: `Modmail ticket opened by ${user.tag} (${user.id})`
    });

    await db.setModmail(user.id, thread.id);
  }

  // 4. If new thread, post introductory header
  if (isNewThread) {
    const headerEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📬 New Modmail Ticket: ${user.tag}`)
      .setDescription(
        `• **Member:** ${user} (\`${user.tag}\`)\n` +
        `• **User ID:** \`${user.id}\`\n\n` +
        `💡 **Staff Instructions:**\n` +
        `• Simply **type normally** in this thread to reply directly to ${user.username} in their DMs!\n` +
        `• When resolved, type \`/modmail close\` in this thread to archive it.`
      )
      .setTimestamp();

    await thread.send({ embeds: [headerEmbed] });
  }

  // 5. Post the incoming message embed inside the thread
  const messageEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setAuthor({
      name: `${user.tag} (Member)`,
      iconURL: user.displayAvatarURL({ dynamic: true })
    })
    .setDescription(content || '*(Attachment sent)*')
    .setFooter({ text: `User ID: ${user.id} • Type in this thread to reply` })
    .setTimestamp();

  if (attachments && attachments.length > 0) {
    const urls = attachments.map(a => a.url).join('\n');
    messageEmbed.addFields({ name: 'Attachments', value: urls });
    const firstImg = attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
    if (firstImg) messageEmbed.setImage(firstImg.url);
  }

  await thread.send({ embeds: [messageEmbed] });

  return { success: true, thread };
}
