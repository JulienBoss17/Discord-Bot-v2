const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const { requireLinked } = require("../../utils/requireLinked");
const LinkedAccount = require("../../models/LinkedAccount");
const axios = require("axios");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare ton rang/statistiques avec un autre membre")
    .addUserOption(opt =>
      opt.setName("membre")
        .setDescription("Le membre à comparer")
        .setRequired(true)
    ),
  lolCommand: true,

  async execute(interaction) {
    const account1 = await requireLinked(interaction);
    if (!account1) return;

    await interaction.deferReply({ flags: 64 });

    const member = interaction.options.getUser("membre");
    const account2 = await LinkedAccount.findOne({ discordId: member.id });
    if (!account2) {
      return interaction.editReply(`❌ ${member.tag} n'a pas lié son compte Riot.`);
    }

    try {
      const fetchRank = async (puuid) => {
        const rankRes = await axios.get(
          `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}?api_key=${RIOT_API_KEY}`
        );
        const soloq = rankRes.data.find(r => r.queueType === "RANKED_SOLO_5x5");
        return soloq ? `${soloq.tier} ${soloq.rank} (${soloq.leaguePoints} LP)` : "Non classé";
      };

      const rank1 = await fetchRank(account1.puuid);
      const rank2 = await fetchRank(account2.puuid);

      const embed = new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`Comparaison League of Legends`)
        .addFields(
          { name: `${interaction.user.username}`, value: rank1, inline: true },
          { name: `${member.username}`, value: rank2, inline: true }
        )
        .setFooter({ text: "Serveur de Julien" });

      await interaction.editReply({ embeds: [embed] });

    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.editReply("❌ Impossible de récupérer les rangs pour la comparaison.");
    }
  }
};
