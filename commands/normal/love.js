const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('love')
    .setDescription('Calcule la compatibilité amoureuse entre deux utilisateurs.')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription("La personne avec qui tu veux tester ton amour ❤️")
        .setRequired(true)
    ),
  async execute(interaction) {
    const user1 = interaction.user;
    const user2 = interaction.options.getUser('utilisateur');

    const score = Math.floor(Math.random() * 101); // 0-100
    let emoji = '💔';
    if (score >= 80) emoji = '💖';
    else if (score >= 60) emoji = '❤️';
    else if (score >= 40) emoji = '💕';
    else if (score >= 20) emoji = '💞';

    await interaction.reply({
      content: `💘 Compatibilité entre ${user1} et ${user2} : **${score}%** ${emoji}`
    });
  }
};
