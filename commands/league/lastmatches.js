const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { requireLinked } = require("../../utils/requireLinked");

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const RIOT_ROUTING = "europe";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastmatches")
    .setDescription("Affiche tes 5 derniers matchs avec stats détaillées"),
  lolCommand: true,

  async execute(interaction) {
    const account = await requireLinked(interaction);
    if (!account) return;

    await interaction.deferReply({ flags: 64 });

    try {
      const { puuid } = account;

      const idsRes = await axios.get(
        `https://${RIOT_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5&api_key=${RIOT_API_KEY}`
      );
      const matchIds = idsRes.data;

      const matchSummaries = [];

      for (const id of matchIds) {
        try {
          const { data } = await axios.get(
            `https://${RIOT_ROUTING}.api.riotgames.com/lol/match/v5/matches/${id}?api_key=${RIOT_API_KEY}`
          );

          const p = data.info.participants.find(x => x.puuid === puuid);
          if (!p) continue;

          const result = p.win ? "✅ Victoire" : "❌ Défaite";
          const durationMin = data.info.gameDuration / 60;
          const durationText = Math.floor(durationMin) + "m " + Math.floor(data.info.gameDuration % 60) + "s";
          const csTotal = p.totalMinionsKilled + p.neutralMinionsKilled;
          const csPerMin = (csTotal / durationMin).toFixed(1);

          matchSummaries.push(
            `• **${p.championName} (${p.teamPosition || "Role inconnu"})** – ${result}\n` +
            `  K/D/A: ${p.kills}/${p.deaths}/${p.assists} | CS: ${csTotal} (${csPerMin}/min) | Gold: ${p.goldEarned}\n` +
            `  Vision: ${p.visionScore} | Durée: ${durationText}`
          );
        } catch {
          continue;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`${account.lolPseudo}#${account.tagLine} – 5 derniers matchs`)
        .setDescription(matchSummaries.join("\n\n") || "Pas de matchs récents.")
        .setFooter({ text: "Serveur de Julien" });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.editReply("❌ Impossible de récupérer tes derniers matchs.");
    }
  },
};
