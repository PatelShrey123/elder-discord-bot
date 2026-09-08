import { Events, EmbedBuilder } from 'discord.js';
import { pendingDMs } from './messageCreate.js';
import { deliverModmailToStaff } from '../services/modmailService.js';

export const name = Events.MessageReactionAdd;

export async function execute(reaction, user) {
  if (user.bot) return;
  if (reaction.emoji.name !== '✅') return;

  const pending = pendingDMs.get(user.id);
  if (!pending) return;

  try {
    const client = reaction.client;
    await deliverModmailToStaff(
      client,
      user,
      pending.content,
      pending.attachments
    );

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
