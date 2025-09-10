const LinkedAccount = require("../models/LinkedAccount");
const axios = require("axios");
const { EmbedBuilder } = require("discord.js");

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION = "europe";

let DATA_DRAGON = null;

// --- Charger DataDragon (patch + contenu FR) ---
async function loadDataDragon() {
  try {
    const patchRes = await axios.get("https://ddragon.leagueoflegends.com/api/versions.json");
    const patch = patchRes.data[0]; // Dernier patch

    const championsRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/fr_FR/champion.json`);
    const champions = championsRes.data.data;

    const itemsRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/fr_FR/item.json`);
    const items = itemsRes.data.data;

    const runesRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/fr_FR/runesReforged.json`);
    const runes = runesRes.data;

    const summonerSpellsRes = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${patch}/data/fr_FR/summoner.json`);
    const spells = summonerSpellsRes.data.data;

    DATA_DRAGON = { patch, champions, items, runes, spells };
    console.log(`✅ DataDragon chargé pour le patch ${patch}`);
  } catch (err) {
    console.error("Erreur chargement DataDragon :", err.message);
  }
}

// --- Helper pour récupérer le nom de l'item ---
function getItemName(itemId) {
  if (!DATA_DRAGON?.items) return `Item${itemId}`;
  return DATA_DRAGON.items[itemId]?.name || `Item${itemId}`;
}

// --- Helper pour récupérer le nom de la rune ---
function getRuneName(perkId) {
  if (!DATA_DRAGON?.runes) return perkId.toString();
  for (const tree of DATA_DRAGON.runes) {
    for (const style of tree.slots) {
      for (const rune of style.runes) {
        if (rune.id === perkId) return rune.name;
      }
    }
  }
  return perkId.toString();
}

// --- Helper pour récupérer le nom du sort ---
function getSpellName(spellId) {
  if (!DATA_DRAGON?.spells) return `Sort${spellId}`;
  for (const key in DATA_DRAGON.spells) {
    if (parseInt(DATA_DRAGON.spells[key].key) === spellId) return DATA_DRAGON.spells[key].name;
  }
  return `Sort${spellId}`;
}

// --- Récupérer dernier match ---
async function getLastMatchId(puuid) {
  try {
    const res = await axios.get(
      `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${RIOT_API_KEY}`
    );
    return res.data[0] || null;
  } catch (err) {
    console.error("Erreur getLastMatchId:", err.response?.data || err.message);
    return null;
  }
}

// --- Récupérer détails du match ---
async function getMatchDetails(matchId) {
  try {
    const res = await axios.get(`https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`);
    return res.data;
  } catch (err) {
    console.error("Erreur getMatchDetails:", err.response?.data || err.message);
    return null;
  }
}

// --- Check Matches ---
module.exports = async function checkMatches(client) {
  if (!DATA_DRAGON) await loadDataDragon();

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const channel = guild.channels.cache.find(c => c.name === "alerte");
  if (!channel) return;

  const accounts = await LinkedAccount.find({});

  for (const acc of accounts) {
    try {
      const lastMatchId = await getLastMatchId(acc.puuid);
      if (!lastMatchId || lastMatchId === acc.lastMatchId) continue;

      const matchData = await getMatchDetails(lastMatchId);
      if (!matchData) continue;

      const participant = matchData.info.participants.find(p => p.puuid === acc.puuid);
      if (!participant) continue;

      // Items
      const items = [];
      for (let i = 0; i <= 6; i++) {
        if (participant[`item${i}`] && participant[`item${i}`] !== 0) {
          items.push(getItemName(participant[`item${i}`]));
        }
      }

      // Sorts
      const summonerSpells = [];
      if (participant.summoner1Id) summonerSpells.push(getSpellName(participant.summoner1Id));
      if (participant.summoner2Id) summonerSpells.push(getSpellName(participant.summoner2Id));

      // Runes
      const runes = participant.perks?.styles?.map(style =>
        style.selections.map(sel => getRuneName(sel.perk)).join(", ")
      ).join(" | ") || "Aucune";

      const embed = new EmbedBuilder()
        .setColor(participant.win ? 0x00FF00 : 0xFF0000)
        .setTitle(`📊 ${acc.lolPseudo} a terminé une partie`)
        .addFields(
          { name: "Champion", value: participant.championName, inline: true },
          { name: "Rôle / Lane", value: participant.teamPosition || "Inconnu", inline: true },
          { name: "Résultat", value: participant.win ? "Victoire 🏆" : "Défaite 💀", inline: true },
          { name: "K/D/A", value: `${participant.kills}/${participant.deaths}/${participant.assists}`, inline: true },
          { name: "CS", value: participant.totalMinionsKilled.toString(), inline: true },
          { name: "Gold", value: participant.goldEarned.toString(), inline: true },
          { name: "Durée", value: `${Math.floor(matchData.info.gameDuration / 60)}m ${matchData.info.gameDuration % 60}s`, inline: true },
          { 
            name: "Dégâts / Soins / Vision", 
            value: 
              `Dégâts aux champions : ${participant.totalDamageDealtToChampions}\n` +
              `Dégâts subis : ${participant.totalDamageTaken}\n` +
              `Soins : ${participant.totalHeal}\n` +
              `Vision : ${participant.visionScore}\n` +
              `Tours détruites : ${participant.turretKills}\n` +
              `Dragons / Hérauts : ${participant.dragonKills || 0} / ${participant.heraldKills || 0}`, 
            inline: false 
          },
          { name: "Sorts", value: summonerSpells.join(" | ") || "Aucun", inline: true },
          { name: "Runes", value: runes || "Aucune", inline: true },
          { name: "Items", value: items.join(" | ") || "Aucun", inline: false }
        )
        .setFooter({ text: `Patch ${DATA_DRAGON.patch}` })
        .setTimestamp();

      await channel.send({ embeds: [embed] });

      acc.lastMatchId = lastMatchId;
      await acc.save();

    } catch (err) {
      console.error(`Erreur match check pour ${acc.discordId}`, err);
    }
  }
};
