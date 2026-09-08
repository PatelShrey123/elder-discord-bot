import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits
} from 'discord.js';
import { db } from '../../database/db.js';

const ALLOWED_ROLES = ['1545037939673792573', '1369832704182583419'];

export const data = new SlashCommandBuilder()
  .setName('modmail-setup')
  .setDescription('Set up the staff inbox channel for Modmail (Restricted Roles Only)')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Select the private staff channel for Modmail')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  );

export async function execute(interaction) {
  const member = interaction.member;
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const hasAllowedRole = ALLOWED_ROLES.some(roleId => member.roles.cache.has(roleId));

  if (!isOwner && !hasAllowedRole) {
    const roleMentions = ALLOWED_ROLES.map(r => `<@&${r}>`).join(' or ');
    return interaction.reply({
      content: `❌ **Access Denied**: You do not have permission to set up Modmail.\nThis command can only be used by members with ${roleMentions} (or the Server Owner).`,
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel('channel');
  await db.setModmailChannel(interaction.guild.id, channel.id);

  // Send an introductory guide in the chosen modmail channel
  const staffNoticeEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📬 Elder Clan Modmail System Activated')
    .setDescription(
      `This channel is now the official staff inbox for incoming member Modmail.\n\n` +
      `**How it works:**\n` +
      `• Whenever a member confirms a Modmail or types \`.modmail\`, their message will appear here.\n` +
      `• **To reply to a member**: Use Discord's native **Reply** feature directly on the bot's message!\n` +
      `• **Casual Chatting**: Staff can chat regularly in this channel anytime—messages are **only** sent to the user when you use Discord's **Reply** function on a modmail ticket!\n` +
      `• **Command Alternative**: You can also use \`/modmail reply user:<id> message:<text>\` or \`/modmail close user:<id>\`.\n`
    )
    .setFooter({ text: 'Elder Clan Modmail • Real-time 2-way routing' })
    .setTimestamp();

  await channel.send({ embeds: [staffNoticeEmbed] }).catch(() => {});

  const replyEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('✅ Modmail Channel Configured')
    .setDescription(`Modmail inbox successfully set to ${channel}. All incoming member messages will now appear there.`)
    .setTimestamp();

  return interaction.reply({ embeds: [replyEmbed] });
}
