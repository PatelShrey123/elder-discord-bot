import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { db } from '../../database/db.js';

export const data = new SlashCommandBuilder()
  .setName('points')
  .setDescription('Elder Points currency and clan economy commands')
  .addSubcommand(sub =>
    sub.setName('balance')
      .setDescription('Check your or another member\'s Elder Points balance')
      .addUserOption(opt => opt.setName('user').setDescription('Target member (defaults to you)'))
  )
  .addSubcommand(sub =>
    sub.setName('add')
      .setDescription('Admin: Award Elder Points to a clan member')
      .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of points to add').setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName('remove')
      .setDescription('Admin: Deduct Elder Points from a member')
      .addUserOption(opt => opt.setName('user').setDescription('Target member').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to remove').setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName('pay')
      .setDescription('Transfer your Elder Points to another member')
      .addUserOption(opt => opt.setName('user').setDescription('Recipient member').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount to transfer').setRequired(true).setMinValue(1))
  )
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('View top Elder Points clan members')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();

  // 1. BALANCE
  if (subcommand === 'balance') {
    const target = interaction.options.getUser('user') || interaction.user;
    const userData = await db.getPoints(target.id);
    const points = userData ? userData.points : 0;

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`🪙 Elder Points Balance`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Member', value: `${target}`, inline: true },
        { name: 'Balance', value: `**${points.toLocaleString()}** Elder Points`, inline: true }
      )
      .setFooter({ text: 'Elder Clan Economy' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 2. ADD (Admin)
  if (subcommand === 'add') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need Manage Server or Administrator permissions to award points.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const updated = await db.addPoints(target.id, target.tag || target.username, amount);

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle('✅ Points Awarded')
      .setDescription(`Successfully gave **+${amount.toLocaleString()}** Elder Points to ${target}!`)
      .addFields({ name: 'New Balance', value: `**${updated.points.toLocaleString()}** Elder Points` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 3. REMOVE (Admin)
  if (subcommand === 'remove') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ You need Manage Server or Administrator permissions to deduct points.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    const updated = await db.addPoints(target.id, target.tag || target.username, -amount);

    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⚠️ Points Deducted')
      .setDescription(`Deducted **-${amount.toLocaleString()}** Elder Points from ${target}.`)
      .addFields({ name: 'New Balance', value: `**${updated.points.toLocaleString()}** Elder Points` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 4. PAY (Transfer)
  if (subcommand === 'pay') {
    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    if (target.id === interaction.user.id) {
      return interaction.reply({ content: '❌ You cannot transfer points to yourself.', ephemeral: true });
    }
    if (target.bot) {
      return interaction.reply({ content: '❌ You cannot transfer points to a bot.', ephemeral: true });
    }

    const senderData = await db.getPoints(interaction.user.id);
    const senderBalance = senderData ? senderData.points : 0;

    if (senderBalance < amount) {
      return interaction.reply({
        content: `❌ Insufficient balance! You have **${senderBalance.toLocaleString()}** Elder Points, but tried to send **${amount.toLocaleString()}**.`,
        ephemeral: true
      });
    }

    // Deduct sender, credit recipient
    await db.addPoints(interaction.user.id, interaction.user.tag || interaction.user.username, -amount);
    const recipientUpdated = await db.addPoints(target.id, target.tag || target.username, amount);

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('💸 Points Transferred')
      .setDescription(`${interaction.user} sent **${amount.toLocaleString()}** Elder Points to ${target}!`)
      .addFields(
        { name: `${target.username}'s New Balance`, value: `**${recipientUpdated.points.toLocaleString()}** Elder Points` }
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // 5. LEADERBOARD
  if (subcommand === 'leaderboard') {
    const topUsers = await db.getLeaderboard(10);

    if (!topUsers || topUsers.length === 0) {
      return interaction.reply({ content: 'No members have Elder Points yet! Earn points via `/daily` or events.', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];
    const rows = topUsers.map((u, i) => {
      const badge = medals[i] || `\`#${i + 1}\``;
      const name = u.username || `<@${u.user_id || u.userId}>`;
      return `${badge} **${name}** — ${u.points.toLocaleString()} Points`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle('🏆 Elder Points Leaderboard')
      .setDescription(rows)
      .setFooter({ text: 'Top 10 Elder Clan Members' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
}
