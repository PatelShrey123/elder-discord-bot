import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('roster')
  .setDescription('Elder Clan Google Sheet roster and member tracking')
  .addSubcommand(sub =>
    sub.setName('view')
      .setDescription('View members on the clan roster Google Sheet')
  )
  .addSubcommand(sub =>
    sub.setName('link')
      .setDescription('Get the direct link to the Elder Clan Google Sheet')
  );

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const sheetUrl = process.env.GOOGLE_SHEET_URL;
  const csvUrl = process.env.GOOGLE_SHEET_CSV_URL;

  if (subcommand === 'link') {
    if (!sheetUrl) {
      return interaction.reply({
        content: 'ℹ️ No Google Sheet URL is configured yet. Add `GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/...` to your `.env` or Render environment variables!',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x0f9d58)
      .setTitle('📊 Elder Clan Google Sheet Roster')
      .setDescription(`Click below to view the official clan spreadsheet:\n\n🔗 [Open Elder Clan Google Sheet](${sheetUrl})`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  if (subcommand === 'view') {
    if (!csvUrl) {
      if (sheetUrl) {
        return interaction.reply({
          content: `📊 **Elder Clan Roster Sheet**: [Open Google Sheet](${sheetUrl})\n\n*(To display live rows inside Discord, publish your sheet to CSV: **File > Share > Publish to web > CSV**, then set \`GOOGLE_SHEET_CSV_URL\` in your environment!)*`
        });
      }
      return interaction.reply({
        content: 'ℹ️ Google Sheet is not configured yet. Set `GOOGLE_SHEET_URL` in your environment to link your clan sheet!',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();

      const lines = text.trim().split('\n').map(l => l.split(','));
      if (lines.length <= 1) {
        return interaction.editReply('The Google Sheet appears to be empty or has only header rows.');
      }

      const headers = lines[0].map(h => h.trim().replace(/^"|"$/g, ''));
      const rows = lines.slice(1, 11); // first 10 rows

      const formatted = rows.map((row, idx) => {
        const cleanRow = row.map(c => c.trim().replace(/^"|"$/g, ''));
        return `**${idx + 1}.** ${cleanRow.join(' • ')}`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x0f9d58)
        .setTitle('📊 Elder Clan Live Roster (Google Sheet)')
        .setDescription(`**Columns:** ${headers.join(' | ')}\n\n${formatted}`)
        .setFooter({ text: `Showing first ${rows.length} rows • Synced from Google Sheets` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[SHEETS ERROR]', err);
      return interaction.editReply(`❌ Failed to fetch Google Sheet data: ${err.message}. Ensure the sheet is Published to Web as CSV.`);
    }
  }
}
