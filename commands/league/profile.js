// commands/lol/profile.js
const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const axios = require("axios");
const { linkedCache } = require("../../utils/requireLinked");
const LinkedAccount = require("../../models/LinkedAccount");

const RIOT_API_KEY = process.env.RIOT_API_KEY;
// Plateforme LoL (pour summoner-v4 & league-v4) — ex: euw1, eun1, na1, kr, br1, la1, la2, oc1, tr1, ru
const RIOT_PLATFORM = process.env.RIOT_PLATFORM || "euw1";
// Région de routage Match-V5 — europe, americas, asia, sea
const RIOT_ROUTING = process.env.RIOT_ROUTING || "europe";

const http = axios.create({
  timeout: 8000,
  headers: { "X-Riot-Token": RIOT_API_KEY },
});

// petite pause pour éviter de cogner les rate-limits
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function tierColor(tier = "") {
  const map = {
    CHALLENGER: 0x00c8ff,
    GRANDMASTER: 0xff3355,
    MASTER: 0xa335ee,
    DIAMOND: 0x7289da,
    EMERALD: 0x2ecc71,
    PLATINUM: 0x1abc9c,
    GOLD: 0xf1c40f,
    SILVER: 0x95a5a6,
    BRONZE: 0xcd7f32,
    IRON: 0x7f8c8d,
  };
  return map[tier?.toUpperCase()] ?? 0x5865f2; // couleur par défaut (Discord blurple)
}

function lanePretty(teamPosition) {
  const map = {
    TOP: "Top",
    JUNGLE: "Jungle",
    MIDDLE: "Mid",
    MID: "Mid",
    BOTTOM: "ADC",
    ADC: "ADC",
    UTILITY: "Support",
    SUPPORT: "Support",
    NONE: "—",
  };
  return map[teamPosition] || "—";
}

async function getLatestDDragonVersion() {
  try {
    const { data } = await axios.get(
      "https://ddragon.leagueoflegends.com/api/versions.json",
      { timeout: 5000 }
    );
    return Array.isArray(data) && data.length ? data[0] : "14.16.1";
  } catch {
    return "14.16.1";
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Affiche un profil LoL avancé (rangs + stats récentes)"),
  lolCommand: true, // si tu as un middleware requireLinked

  async execute(interaction) {
    const discordId = interaction.user.id;

    // 1) Récup compte lié (cache -> mongo)
    const riotAccount =
      interaction.riotAccount ||
      linkedCache.get(discordId)?.account ||
      (await LinkedAccount.findOne({ discordId }));

    if (!riotAccount) {
      return interaction.reply({
        content:
          "❌ Aucun compte Riot lié. Utilise d’abord `/link Pseudo#Tag` pour associer ton compte.",
      flags: 64 // ephemeral
      });
    }

    const { lolPseudo, tagLine, puuid } = riotAccount;

    await interaction.deferReply();

    try {
      // 2) Summoner (niveau + icône)
      const summonerUrl = `https://${RIOT_PLATFORM}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(
        puuid
      )}`;
      const { data: summ } = await http.get(summonerUrl);

      const profileIconId = summ.profileIconId;
      const summonerLevel = summ.summonerLevel;

      // 3) Ranks par PUUID (SoloQ/Flex + WR)
      const leagueUrl = `https://${RIOT_PLATFORM}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(
        puuid
      )}`;
      const { data: entries } = await http.get(leagueUrl);

      const soloq = entries.find((e) => e.queueType === "RANKED_SOLO_5x5");
      const flex = entries.find((e) => e.queueType === "RANKED_FLEX_SR");

      // 4) 20 derniers matchs pour stats
      const matchIdsUrl = `https://${RIOT_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(
        puuid
      )}/ids?start=0&count=20`;
      const { data: matchIds } = await http.get(matchIdsUrl);

      // Récup détail des matchs (petit throttle)
      const matches = [];
      for (const id of matchIds) {
        try {
          const { data } = await http.get(
            `https://${RIOT_ROUTING}.api.riotgames.com/lol/match/v5/matches/${id}`
          );
          matches.push(data);
          await sleep(150); // throttle léger
        } catch (e) {
          // ignore un match en erreur (peut arriver si remakes/ARAM spéciaux)
        }
      }

      // 5) Agrégation des stats du joueur
      let games = 0;
      let wins = 0;
      let kills = 0;
      let deaths = 0;
      let assists = 0;
      let cs = 0;
      let dur = 0;

      const byChampion = new Map(); // champ -> {games,wins}
      const byLane = new Map(); // lane -> count

      for (const m of matches) {
        const p = m?.info?.participants?.find((x) => x.puuid === puuid);
        if (!p) continue;

        games += 1;
        if (p.win) wins += 1;

        kills += p.kills || 0;
        deaths += p.deaths || 0;
        assists += p.assists || 0;

        const minions =
          (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0);
        cs += minions;

        const durationSec = m?.info?.gameDuration || 0;
        dur += durationSec;

        const champ = p.championName || "—";
        const lane = lanePretty(p.teamPosition);

        const c = byChampion.get(champ) || { games: 0, wins: 0 };
        c.games += 1;
        if (p.win) c.wins += 1;
        byChampion.set(champ, c);

        byLane.set(lane, (byLane.get(lane) || 0) + 1);
      }

      const wrGlobal = games ? Math.round((wins / games) * 100) : 0;
      const avgKills = games ? (kills / games).toFixed(1) : "0.0";
      const avgDeaths = games ? (deaths / games).toFixed(1) : "0.0";
      const avgAssists = games ? (assists / games).toFixed(1) : "0.0";
      const kdaRatio =
        deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : "Perfect";
      const avgCS = games ? Math.round(cs / games) : 0;
      const avgDurMin = games ? Math.round(dur / games / 60) : 0;

      // Top champion (le plus joué) + son WR
      let topChamp = null;
      for (const [champ, stats] of byChampion.entries()) {
        if (!topChamp || stats.games > topChamp.games) {
          topChamp = { champ, ...stats };
        }
      }
      const topChampText = topChamp
        ? `${topChamp.champ} (${topChamp.games} games – ${Math.round(
            (topChamp.wins / topChamp.games) * 100
          )}% WR)`
        : "—";

      // Lane préférée
      let topLane = null;
      for (const [lane, count] of byLane.entries()) {
        if (!topLane || count > topLane.count) {
          topLane = { lane, count };
        }
      }
      const favLane = topLane ? `${topLane.lane}` : "—";

      // Couleur d'embed basée sur le rang le plus haut
      const primaryTier =
        soloq?.tier ||
        flex?.tier ||
        (entries[0]?.tier ?? ""); // fallback
      const color = tierColor(primaryTier);

      // Icône invocateur (Data Dragon)
      const ddVersion = await getLatestDDragonVersion();
      const iconUrl = `https://ddragon.leagueoflegends.com/cdn/${ddVersion}/img/profileicon/${profileIconId}.png`;

      // Champs rangs
      const soloStr = soloq
        ? `${soloq.tier} ${soloq.rank} (${soloq.leaguePoints} LP) — ${Math.round(
            (soloq.wins / (soloq.wins + soloq.losses)) * 100
          )}% WR`
        : "Unranked";

      const flexStr = flex
        ? `${flex.tier} ${flex.rank} (${flex.leaguePoints} LP) — ${Math.round(
            (flex.wins / (flex.wins + flex.losses)) * 100
          )}% WR`
        : "Unranked";

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({
          name: `${lolPseudo}#${tagLine}`,
          iconURL: iconUrl,
        })
        .setThumbnail(iconUrl)
        .setDescription(`Niveau **${summonerLevel}**`)
        .addFields(
          {
            name: "🎯 SoloQ",
            value: soloStr,
            inline: true,
          },
          {
            name: "🎯 Flex",
            value: flexStr,
            inline: true,
          },
          {
            name: `📊 Stats sur les ${games || 0} dernières games`,
            value:
              games > 0
                ? [
                    `• Winrate global : **${wrGlobal}%** (${wins}W/${games - wins}L)`,
                    `• K/D/A moyen : **${avgKills} / ${avgDeaths} / ${avgAssists}**  → KDA: **${kdaRatio}**`,
                    `• CS moyen : **${avgCS}**`,
                    `• Durée moyenne : **${avgDurMin} min**`,
                    `• Champion le plus joué : **${topChampText}**`,
                    `• Lane préférée : **${favLane}**`,
                  ].join("\n")
                : "Pas assez de matchs récents pour calculer des stats.",
          }
        )
        .setFooter({ text: "Serveur de Julien" });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.editReply(
        "❌ Impossible de récupérer le profil. Vérifie la région configurée et réessaie."
      );
    }
  },
};
