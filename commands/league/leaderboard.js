const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const LinkedAccount = require("../../models/LinkedAccount");
const axios = require("axios");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

// Mapping tiers pour le tri
const tierOrder = {
  "CHALLENGER": 9,
  "GRANDMASTER": 8,
  "MASTER": 7,
  "DIAMOND": 6,
  "PLATINUM": 5,
  "GOLD": 4,
  "SILVER": 3,
  "BRONZE": 2,
  "IRON": 1,
  "UNRANKED": 0
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Classement des membres du serveur par rang SoloQ"),
  lolCommand: false,

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const accounts = await LinkedAccount.find({});
      if (!accounts.length) {
        return interaction.editReply("❌ Aucun compte Riot lié sur ce serveur.");
      }

      const leaderboard = [];

      for (const acc of accounts) {
        try {
          const rankRes = await axios.get(
            `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${acc.puuid}?api_key=${RIOT_API_KEY}`
          );

          const soloq = rankRes.data.find(r => r.queueType === "RANKED_SOLO_5x5");
          const tier = soloq ? soloq.tier.toUpperCase() : "UNRANKED";
          const lp = soloq ? soloq.leaguePoints : 0;
          const totalScore = tierOrder[tier] * 1000 + lp;

          leaderboard.push({
            discordId: acc.discordId,
            rank: soloq ? `${soloq.tier} ${soloq.rank}` : "Non classé",
            lp,
            totalScore
          });

        } catch {
          leaderboard.push({
            discordId: acc.discordId,
            rank: "Non classé",
            lp: 0,
            totalScore: 0
          });
        }
      }

      // Tri par tier puis LP
      leaderboard.sort((a, b) => b.totalScore - a.totalScore);

      const description = leaderboard
        .slice(0, 10)
        .map((u, i) => `**${i + 1}.** <@${u.discordId}> – ${u.rank} (${u.lp} LP)`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("🏆 Leaderboard SoloQ")
        .setDescription(description)
        .setFooter({ text: "Serveur de Julien" });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.editReply("❌ Impossible de générer le leaderboard.");
    }
  }
};
