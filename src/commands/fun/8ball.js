import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const RESPONSES = [
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  'Don\'t count on it.',
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.'
];

export const data = new SlashCommandBuilder()
  .setName('8ball')
  .setDescription('Ask the Magic 8-Ball a question')
  .addStringOption(opt =>
    opt.setName('question')
      .setDescription('Your question')
      .setRequired(true)
  );

export async function execute(interaction) {
  const question = interaction.options.getString('question');
  const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle('🎱 Magic 8-Ball')
    .addFields(
      { name: 'Question', value: question },
      { name: 'Answer', value: `*${answer}*` }
    )
    .setFooter({ text: `Asked by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
