import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Elder Clan Blacklist system (iWin style)')
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Add an offender/applicant to the blacklist')
      .addStringOption(opt => opt.setName('target').setDescription('User ID or mention of the target').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for blacklist').setRequired(true))
      .addStringOption(opt => opt.setName('proof').setDescription('Screenshot/video link or evidence proof'))
  )
  .addSubcommand(sub =>
    sub.setName('check')
      .setDescription('Check if a user ID or applicant is in the blacklist')
      .addStringOption(opt => opt.setName('target').setDescription('User ID or mention to check').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Remove a user from the blacklist')
      .addStringOption(opt => opt.setName('target').setDescription('User ID or mention to remove').setRequired(true))
  )
  .addSubcommand(sub =>
    sub.setName('list')
      .setDescription('List all currently blacklisted users')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  // Helper to extract clean Discord ID
  function extractId(input) {
    return input.replace(/[<@!>]/g, '').trim();
  }

  // 1. CHECK (Available to all clan staff/members)
  if (subcommand === 'check') {
    const rawTarget = interaction.options.getString('target');
    const targetId = extractId(rawTarget);

    const record = await db.getBlacklist(targetId);

    if (!record) {
      const cleanEmbed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle('✅ Clean Status')
        .setDescription(`User ID \`${targetId}\` is **NOT** in the Elder Blacklist.`)
        .setFooter({ text: 'Applicant check passed' })
        .setTimestamp();

      return interaction.reply({ embeds: [cleanEmbed] });
    }

    const alertEmbed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🚨 BLACKLISTED USER FOUND')
      .setDescription(`⚠️ **Warning:** User <@${record.targetId}> (\`${record.targetId}\`) is on the official Blacklist!`)
      .addFields(
        { name: 'Target Tag', value: record.targetTag || 'Unknown', inline: true },
        { name: 'Added By', value: record.addedBy, inline: true },
        { name: 'Added Date', value: new Date(record.addedAt).toLocaleDateString(), inline: true },
        { name: 'Reason', value: `\`\`\`${record.reason}\`\`\`` },
        { name: 'Proof / Evidence', value: record.proof || 'None provided' }
      )
      .setFooter({ text: 'Do NOT accept into Elder clan or trust for trades' })
      .setTimestamp();

    return interaction.reply({ embeds: [alertEmbed] });
  }

  // Require staff permissions for ADD, REMOVE, and full LIST
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) &&
      !interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ content: '❌ You need Staff / Moderator permissions to manage the blacklist.', ephemeral: true });
  }

  // 2. ADD
  if (subcommand === 'add') {
    const rawTarget = interaction.options.getString('target');
    const targetId = extractId(rawTarget);
    const reason = interaction.options.getString('reason');
    const proof = interaction.options.getString('proof');

    // Attempt to fetch user tag from client
    let targetTag = 'Unknown';
    try {
      const fetchedUser = await interaction.client.users.fetch(targetId);
      if (fetchedUser) targetTag = fetchedUser.tag || fetchedUser.username;
    } catch {
      // User ID might not share a server with bot
    }

    await db.addBlacklist(
      targetId,
      targetTag,
      reason,
      proof,
      `${interaction.user.tag || interaction.user.username} (${interaction.user.id})`
    );

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🚫 User Added to Blacklist')
      .setDescription(`Recorded <@${targetId}> into the permanent Elder Blacklist database.`)
      .addFields(
        { name: 'User ID', value: `\`${targetId}\``, inline: true },
        { name: 'Username/Tag', value: targetTag, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Proof', value: proof || 'None' }
      )
      .setFooter({ text: `Added by ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 3. REMOVE
  if (subcommand === 'remove') {
    const rawTarget = interaction.options.getString('target');
    const targetId = extractId(rawTarget);

    const removed = await db.removeBlacklist(targetId);

    if (!removed) {
      return interaction.reply({ content: `❌ User ID \`${targetId}\` was not found in the blacklist.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ User Removed from Blacklist')
      .setDescription(`Successfully removed <@${targetId}> (\`${targetId}\`) from the blacklist.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 4. LIST
  if (subcommand === 'list') {
    const list = await db.getAllBlacklist();

    if (!list || list.length === 0) {
      return interaction.reply({ content: 'The blacklist is currently empty.', ephemeral: true });
    }

    const lines = list.slice(0, 15).map((entry, idx) => {
      return `**${idx + 1}.** <@${entry.targetId}> (\`${entry.targetId}\`)\n• **Reason:** ${entry.reason.substring(0, 50)}${entry.reason.length > 50 ? '...' : ''}\n• **Added By:** ${entry.addedBy}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`📋 Elder Clan Blacklist (${list.length} Records)`)
      .setDescription(lines)
      .setFooter({ text: 'Displaying up to 15 recent blacklist entries' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
