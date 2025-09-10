const LinkedAccount = require("../models/LinkedAccount");
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const PLATFORM = "euw1"; // à adapter

async function getRank(summonerName, tagLine) {
  try {
    const accountRes = await axios.get(
      `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
    );

    const summonerRes = await axios.get(
      `https://${PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${accountRes.data.puuid}?api_key=${RIOT_API_KEY}`
    );

    const leagueRes = await axios.get(
      `https://${PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerRes.data.id}?api_key=${RIOT_API_KEY}`
    );

    const soloQ = leagueRes.data.find(q => q.queueType === "RANKED_SOLO_5x5");
    if (!soloQ) return "Unranked";
    return `${soloQ.tier} ${soloQ.rank}`;
  } catch (err) {
    console.error("Erreur getRank:", err.response?.data || err.message);
    return null;
  }
}

module.exports = async function checkRanks(client) {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.find(c => c.name === "alerte");
  if (!channel) return;

  const accounts = await LinkedAccount.find({});
  for (const acc of accounts) {
    try {
      const newRank = await getRank(acc.lolPseudo, acc.tagLine);
      if (!newRank) continue;

      if (newRank !== acc.lastRank) {
        const embed = new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle("🔥 Rank Up !")
          .setDescription(`<@${acc.discordId}> a changé de rang !`)
          .addFields(
            { name: "Ancien rang", value: acc.lastRank || "Unranked", inline: true },
            { name: "Nouveau rang", value: newRank, inline: true }
          )
          .setThumbnail(`https://ddragon.leagueoflegends.com/cdn/12.23.1/img/profileicon/1.png`)
          .setTimestamp();

        channel.send({ embeds: [embed] });

        acc.lastRank = newRank;
        await acc.save();
      }
    } catch (err) {
      console.error(`Erreur rank check pour ${acc.discordId}`, err);
    }
  }
};
