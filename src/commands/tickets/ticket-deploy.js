import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-deploy')
  .setDescription('Deploy the configured Ticket Tool panel with interactive buttons')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Channel to send the ticket panel in (defaults to current channel)')
      .addChannelTypes(ChannelType.GuildText)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  const config = await db.getTicketConfig(interaction.guild.id);

  const embed = new EmbedBuilder()
    .setColor(config.panelColor ? parseInt(config.panelColor.replace('#', ''), 16) : 0x5865f2)
    .setTitle(config.panelTitle || '📩 Elder Clan Applications & Support')
    .setDescription(config.panelDescription || 'Click the button below to open a private ticket with our staff!')
    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
    .setFooter({ text: 'Elder Clan Ticket Tool • 24/7 Automated' });

  const button = new ButtonBuilder()
    .setCustomId('btn_create_ticket')
    .setLabel(config.buttonText || 'Open Ticket')
    .setEmoji(config.buttonEmoji || '📩')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  try {
    await targetChannel.send({ embeds: [embed], components: [row] });
    await db.setTicketConfig(interaction.guild.id, { panelChannelId: targetChannel.id });

    await interaction.reply({
      content: `✅ Ticket panel successfully deployed to ${targetChannel}! Users can now click **${config.buttonText || 'Open Ticket'}** to create tickets.`,
      ephemeral: true
    });
  } catch (err) {
    console.error('[TICKET DEPLOY ERROR]', err);
    await interaction.reply({
      content: `❌ Could not send panel to ${targetChannel}: ${err.message}`,
      ephemeral: true
    });
  }
}
