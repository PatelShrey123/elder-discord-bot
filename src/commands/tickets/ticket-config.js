import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType
} from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-config')
  .setDescription('Configure Elder Clan Ticket Tool settings')
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('View current Ticket Tool panel configuration')
  )
  .addSubcommand(sub =>
    sub.setName('category')
      .setDescription('Set the category where new ticket channels will be created')
      .addChannelOption(opt =>
        opt.setName('category')
          .setDescription('Select the ticket category')
          .addChannelTypes(ChannelType.GuildCategory)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('add-role')
      .setDescription('Add a Support Team role that can view and answer tickets')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Select the staff / support role')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('remove-role')
      .setDescription('Remove a Support Team role')
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Select the role to remove')
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('logs')
      .setDescription('Set the channel where ticket transcripts and logs will be sent')
      .addChannelOption(opt =>
        opt.setName('channel')
          .setDescription('Select the logs channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand(sub =>
    sub.setName('panel-message')
      .setDescription('Customize the ticket panel embed title and description')
      .addStringOption(opt => opt.setName('title').setDescription('Panel title').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Panel description / instructions').setRequired(true))
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guild.id;
  const currentConfig = await db.getTicketConfig(guildId);

  // 1. VIEW CONFIG
  if (subcommand === 'view') {
    const categoryDisplay = currentConfig.categoryId
      ? `<#${currentConfig.categoryId}> (\`${currentConfig.categoryName || currentConfig.categoryId}\`)`
      : '*None (tickets create at server root)*';

    const rolesDisplay = (currentConfig.supportRoles && currentConfig.supportRoles.length > 0)
      ? currentConfig.supportRoles.map(r => `<@&${r}>`).join(', ')
      : '*None configured (admin only)*';

    const logsDisplay = currentConfig.loggingChannelId
      ? `<#${currentConfig.loggingChannelId}>`
      : '*Disabled*';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('⚙️ Elder Ticket Tool Configuration')
      .setDescription('Here are the active ticket panel settings for this server:')
      .addFields(
        { name: 'Category Created/Opened', value: categoryDisplay, inline: false },
        { name: 'Support Team Roles', value: rolesDisplay, inline: false },
        { name: 'Logging & Transcripts Channel', value: logsDisplay, inline: false },
        { name: 'Panel Title', value: currentConfig.panelTitle || 'Default', inline: true },
        { name: 'Button Text', value: `${currentConfig.buttonEmoji || '📩'} ${currentConfig.buttonText || 'Open Ticket'}`, inline: true },
        { name: 'Web Dashboard', value: 'Configure anytime at `/ticketsetup` on your website!', inline: false }
      )
      .setFooter({ text: 'Use /ticket-deploy <channel> to send the panel to Discord!' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 2. SET CATEGORY
  if (subcommand === 'category') {
    const category = interaction.options.getChannel('category');
    await db.setTicketConfig(guildId, {
      categoryId: category.id,
      categoryName: category.name
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Ticket Category Set')
      .setDescription(`All new tickets will now open inside **${category.name}** (<#${category.id}>).`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 3. ADD ROLE
  if (subcommand === 'add-role') {
    const role = interaction.options.getRole('role');
    const roles = currentConfig.supportRoles || [];

    if (roles.includes(role.id)) {
      return interaction.reply({ content: `ℹ️ Role ${role} is already in the Support Team roles.`, ephemeral: true });
    }

    roles.push(role.id);
    await db.setTicketConfig(guildId, { supportRoles: roles });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Support Role Added')
      .setDescription(`Added ${role} to the Support Team. Members with this role can now see and manage all tickets.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 4. REMOVE ROLE
  if (subcommand === 'remove-role') {
    const role = interaction.options.getRole('role');
    let roles = currentConfig.supportRoles || [];

    if (!roles.includes(role.id)) {
      return interaction.reply({ content: `❌ Role ${role} was not in the Support Team roles.`, ephemeral: true });
    }

    roles = roles.filter(id => id !== role.id);
    await db.setTicketConfig(guildId, { supportRoles: roles });

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🗑️ Support Role Removed')
      .setDescription(`Removed ${role} from the Support Team.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 5. SET LOGS
  if (subcommand === 'logs') {
    const channel = interaction.options.getChannel('channel');
    await db.setTicketConfig(guildId, { loggingChannelId: channel.id });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Logging Channel Set')
      .setDescription(`Ticket transcripts and logs will be sent to ${channel}.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 6. PANEL MESSAGE
  if (subcommand === 'panel-message') {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');

    await db.setTicketConfig(guildId, {
      panelTitle: title,
      panelDescription: description
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Panel Message Updated')
      .setDescription(`Updated panel message:\n**Title:** ${title}\n**Description:** ${description}`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
