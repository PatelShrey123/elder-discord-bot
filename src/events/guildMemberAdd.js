import { Events, EmbedBuilder } from 'discord.js';
import { db } from '../database/db.js';

export const name = Events.GuildMemberAdd;

export async function execute(member) {
  try {
    const record = await db.getBlacklist(member.id);

    if (record) {
      console.warn(`[BLACKLIST ALERT] Blacklisted user joined: ${member.user.tag} (${member.id})`);

      const alertEmbed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🚨 BLACKLIST DETECTED ON MEMBER JOIN')
        .setDescription(
          `⚠️ **Warning Staff:** A blacklisted user has joined the server!\n\n` +
          `• **Member:** ${member} (\`${member.user.tag}\`)\n` +
          `• **User ID:** \`${member.id}\`\n` +
          `• **Reason:** \`\`\`${record.reason}\`\`\`\n` +
          `• **Proof:** ${record.proof || 'None provided'}\n` +
          `• **Added By:** ${record.addedBy}`
        )
        .setFooter({ text: 'Automated Elder Blacklist Shield' })
        .setTimestamp();

      // Send to Modmail channel if configured, otherwise system channel
      const targetChannelId = process.env.MODMAIL_CHANNEL_ID || member.guild.systemChannelId;
      if (targetChannelId) {
        const channel = member.guild.channels.cache.get(targetChannelId);
        if (channel) {
          await channel.send({
            content: `🚨 **Staff Alert:** ${process.env.STAFF_ROLE_ID ? `<@&${process.env.STAFF_ROLE_ID}>` : ''}`,
            embeds: [alertEmbed]
          });
        }
      }
    }
  } catch (err) {
    console.error('[GUILD MEMBER ADD SCANNER ERROR]', err);
  }
}
