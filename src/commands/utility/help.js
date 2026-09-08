import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Lists all available Elder Clan commands and features');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('📖 Elder Discord Bot — Command Guide')
    .setDescription('Here are all the commands available for the Elder Clan server:')
    .addFields(
      {
        name: '🪙 Elder Points Economy',
        value: '• `/points balance [user]` — Check Elder Points balance\n• `/points add <user> <amount>` — Admin: Award points\n• `/points remove <user> <amount>` — Admin: Deduct points\n• `/points pay <user> <amount>` — Transfer points to another member\n• `/points leaderboard` — Top 10 richest clan members\n• `/daily` — Claim 100 daily Elder Points'
      },
      {
        name: '🚫 Blacklist System (iWin Style)',
        value: '• `/blacklist check <user_or_id>` — Check if a player or applicant is blacklisted\n• `/blacklist add <user_or_id> <reason> [proof]` — Staff: Blacklist an offender\n• `/blacklist remove <user_or_id>` — Staff: Remove from blacklist\n• `/blacklist list` — Staff: View all blacklisted players'
      },
      {
        name: '📬 Modmail System',
        value: '• `/modmail reply <user> <message>` — Reply to a member\'s private DM\n• `/modmail close <user>` — Close an active modmail ticket'
      },
      {
        name: '📊 Google Sheets & Roster',
        value: '• `/roster link` — Direct link to the Elder Clan spreadsheet\n• `/roster view` — View live rows from the Google Sheet roster'
      },
      {
        name: '🎲 Fun & Clan Utility',
        value: '• `/coinflip` — Flip a coin\n• `/roll [max]` — Roll dice (1-100 or custom)\n• `/8ball <question>` — Ask the magic 8-ball\n• `/echo <message>` — Repeat a message\n• `/purge <count>` — Moderator: Bulk delete messages\n• `/ping` — View bot latency\n• `/botinfo` — View uptime and hosting status'
      }
    )
    .setFooter({ text: 'Elder Clan Bot • 24/7 Render Cloud' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
