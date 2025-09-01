const { SlashCommandBuilder } = require("@discordjs/builders");
const axios = require("axios");
const { linkedCache } = require("../../utils/requireLinked");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Affiche ton rang LoL en SoloQ/Flex"),
  lolCommand: true, // middleware requireLinked

  async execute(interaction) {
    const discordId = interaction.user.id;

    // Récupérer le compte Riot depuis le cache ou interaction
    const riotAccount = interaction.riotAccount || linkedCache.get(discordId)?.account;
    if (!riotAccount) {
      return interaction.reply({
        content: "❌ Aucun compte Riot lié. Utilise `/link` d'abord.",
        ephemeral: true
      });
    }

    const { lolPseudo, tagLine, puuid } = riotAccount;

    await interaction.deferReply();

    try {
      // Récupérer tous les ranks via PUUID
      const rankRes = await axios.get(
        `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`
      );

      const ranks = rankRes.data;

      if (!ranks || ranks.length === 0) {
        return interaction.editReply(`📊 ${lolPseudo}#${tagLine} n’a pas de rang enregistré.`);
      }

      // Extraire SoloQ et Flex
      const soloq = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");
      const flex = ranks.find(r => r.queueType === "RANKED_FLEX_SR");

      let replyMsg = `📊 **${lolPseudo}#${tagLine}**\n`;

      if (soloq) {
        replyMsg += `**SoloQ**: ${soloq.tier} ${soloq.rank} (${soloq.leaguePoints} LP) - Wins: ${soloq.wins}, Losses: ${soloq.losses}, Winrate: ${Math.round((soloq.wins/(soloq.wins+soloq.losses))*100)}%\n`;
      } else {
        replyMsg += "**SoloQ**: Aucun rang.\n";
      }

      if (flex) {
        replyMsg += `**Flex**: ${flex.tier} ${flex.rank} (${flex.leaguePoints} LP) - Wins: ${flex.wins}, Losses: ${flex.losses}, Winrate: ${Math.round((flex.wins/(flex.wins+flex.losses))*100)}%`;
      } else {
        replyMsg += "**Flex**: Aucun rang.";
      }

      await interaction.editReply(replyMsg);

    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.editReply("❌ Impossible de récupérer ton rang LoL.");
    }
  }
};
