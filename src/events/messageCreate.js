import {
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { db } from '../database/db.js';

export const name = Events.MessageCreate;

// Cache pending DMs awaiting confirmation: userId => { content, attachments, promptMsgId }
export const pendingDMs = new Map();

export async function execute(message) {
  if (message.author.bot) return;

  const client = message.client;

  // =========================================================
  // 1. GUILD MESSAGES (.modmail command & Staff native replies)
  // =========================================================
  if (message.guild) {
    const content = message.content.trim();

    // A. Handle .modmail command
    if (content.toLowerCase() === '.modmail' || content.toLowerCase().startsWith('.modmail ')) {
      try {
        const userPromptEmbed = new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('📬 Elder Clan Modmail')
          .setDescription(
            `👋 Hello **${message.author.username}**!\n\n` +
            `Please reply to this DM with the message, report, or question you want to send to the **Elder Staff Team**.\n\n` +
            `*(You will be asked to confirm before your message is sent to staff!)*`
          )
          .setFooter({ text: 'Elder Clan Modmail Support' })
          .setTimestamp();

        await message.author.send({ embeds: [userPromptEmbed] });

        // Confirm in the server channel
        await message.reply({
          content: `📬 ${message.author}, I have sent you a DM! Please check your direct messages to type your message to staff.`
        }).then(replyMsg => {
          setTimeout(() => replyMsg.delete().catch(() => {}), 8000);
        });
      } catch (dmErr) {
        await message.reply({
          content: `❌ ${message.author}, could not DM you! Please make sure **"Allow direct messages from server members"** is enabled in your Discord Privacy Settings.`
        });
      }
      return;
    }

    // B. Check if message is in the configured Modmail Channel
    const configuredChannelId = await db.getModmailChannel(message.guild.id);

    if (configuredChannelId && message.channel.id === configuredChannelId) {
      // Check if this is a native Discord Reply to a previous modmail message
      if (message.reference && message.reference.messageId) {
        try {
          const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

          if (referencedMessage && referencedMessage.author.id === client.user.id) {
            // Extract the user ID from the bot's embed footer
            const footerText = referencedMessage.embeds[0]?.footer?.text || '';
            const match = footerText.match(/User ID:\s*(\d+)/i);

            if (match && match[1]) {
              const targetUserId = match[1];
              const targetUser = await client.users.fetch(targetUserId);

              if (targetUser) {
                const staffReplyEmbed = new EmbedBuilder()
                  .setColor(0x2ecc71)
                  .setAuthor({
                    name: `Elder Staff Team (from ${message.author.username})`,
                    iconURL: message.author.displayAvatarURL({ dynamic: true })
                  })
                  .setDescription(message.content || '*(Attachment sent)*')
                  .setFooter({ text: 'Reply to this DM to continue communicating with staff.' })
                  .setTimestamp();

                if (message.attachments.size > 0) {
                  const attachmentUrls = message.attachments.map(a => a.url).join('\n');
                  staffReplyEmbed.addFields({ name: 'Attachments', value: attachmentUrls });
                  const firstImg = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
                  if (firstImg) staffReplyEmbed.setImage(firstImg.url);
                }

                await targetUser.send({ embeds: [staffReplyEmbed] });
                await message.react('✅').catch(() => {});
                return;
              }
            }
          }
        } catch (err) {
          console.error('[NATIVE MODMAIL REPLY ERROR]', err);
          await message.reply('❌ Could not deliver reply to user. Their DMs may be closed.').catch(() => {});
          return;
        }
      }

      // If NOT a reply, staff is chatting casually in the channel -> DO NOTHING!
      return;
    }

    return;
  }

  // =========================================================
  // 2. DIRECT MESSAGES (DMs to the Bot with Confirmation Safeguard)
  // =========================================================
  if (!message.guild) {
    // Helper to get target modmail channel from active guilds
    let targetChannel = null;
    for (const [, guild] of client.guilds.cache) {
      const channelId = await db.getModmailChannel(guild.id);
      if (channelId && guild.channels.cache.has(channelId)) {
        targetChannel = guild.channels.cache.get(channelId);
        break;
      }
    }

    if (!targetChannel) {
      return message.reply('ℹ️ The Elder Modmail inbox is not yet configured on any server. A staff member needs to run `/modmail-setup <channel>`.');
    }

    // Save pending DM data for confirmation
    pendingDMs.set(message.author.id, {
      content: message.content,
      attachments: Array.from(message.attachments.values()),
      targetChannelId: targetChannel.id,
      guildId: targetChannel.guild.id
    });

    const previewContent = message.content ? `> "${message.content.substring(0, 300)}"` : '*(Attachment/File)*';

    const confirmEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('❓ Send Modmail to Elder Staff?')
      .setDescription(
        `You sent the following message:\n${previewContent}\n\n` +
        `**Would you like to deliver this to the Elder Clan Staff Team?**\n` +
        `• Click **✅ Send to Staff** below (or react with ✅).\n` +
        `• If you sent this by accident, click **❌ Cancel**.`
      )
      .setFooter({ text: 'Accidental DM Safeguard • Click below to proceed' })
      .setTimestamp();

    const btnConfirm = new ButtonBuilder()
      .setCustomId('btn_confirm_modmail')
      .setLabel('Send to Staff')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success);

    const btnCancel = new ButtonBuilder()
      .setCustomId('btn_cancel_modmail')
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(btnConfirm, btnCancel);

    const promptMessage = await message.reply({ embeds: [confirmEmbed], components: [row] });
    await promptMessage.react('✅').catch(() => {});
  }
}
