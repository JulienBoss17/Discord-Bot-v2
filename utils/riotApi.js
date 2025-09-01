const axios = require("axios");
const REGION = "euw1"; // change si besoin

const RIOT_API_KEY = process.env.RIOT_API_KEY;

async function getSummonerByName(name) {
  const url = `https://${REGION}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(name)}`;
  const res = await axios.get(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  return res.data;
}

async function getRankBySummonerId(summonerId) {
  const url = `https://${REGION}.api.riotgames.com/lol/league/v4/entries/by-summoner/${summonerId}`;
  const res = await axios.get(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  return res.data;
}

module.exports = { getSummonerByName, getRankBySummonerId };
