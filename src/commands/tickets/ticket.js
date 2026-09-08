import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-setup')
  .setDescription('Deploy a ticket panel with interactive buttons for support and clan applications')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Channel to send the ticket panel in')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('title')
      .setDescription('Panel embed title (default: Elder Clan Support & Tickets)')
  )
  .addStringOption(opt =>
    opt.setName('description')
      .setDescription('Panel description / instructions')
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const targetChannel = interaction.options.getChannel('channel');
  const title = interaction.options.getString('title') || '📩 Elder Clan Support & Applications';
  const description = interaction.options.getString('description') ||
    'Need assistance, want to report an issue, or apply for the Elder Clan?\n\nClick the button below to open a private ticket with our staff team!';

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(description)
    .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
    .setFooter({ text: 'Elder Clan Ticket System • Click below to open' });

  const button = new ButtonBuilder()
    .setCustomId('btn_create_ticket')
    .setLabel('Open Ticket')
    .setEmoji('📩')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  try {
    await targetChannel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ Ticket panel successfully deployed to ${targetChannel}!`, ephemeral: true });
  } catch (err) {
    console.error('[TICKET SETUP ERROR]', err);
    await interaction.reply({ content: `❌ Failed to send ticket panel: ${err.message}`, ephemeral: true });
  }
}
