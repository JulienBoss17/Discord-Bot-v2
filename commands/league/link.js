const { SlashCommandBuilder } = require("@discordjs/builders");
const axios = require("axios");
const LinkedAccount = require("../../models/LinkedAccount");
const { linkedCache } = require("../../utils/requireLinked");

const RIOT_API_KEY = process.env.RIOT_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Associe ton compte Discord à ton compte Riot (LoL)")
    .addStringOption(opt =>
      opt.setName("pseudo")
        .setDescription("Ton pseudo Riot (ex: Sofiaaa#0000)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const fullPseudo = interaction.options.getString("pseudo");

    // Vérifier si l'utilisateur a déjà lié un compte
    const existingAccount = await LinkedAccount.findOne({ discordId });
    if (existingAccount) {
      return interaction.reply({
        content: "❌ Tu as déjà lié un compte Riot. Cette opération n'est pas autorisée plus d'une fois.",
        ephemeral: true
      });
    }

    // Découper en gameName + tagLine
    if (!fullPseudo.includes("#")) {
      return interaction.reply({
        content: "❌ Merci de fournir ton pseudo complet : `Pseudo#Tag`.",
        ephemeral: true
      });
    }

    const [gameName, tagLine] = fullPseudo.split("#");

    try {
      // Récupérer le PUUID via Riot API
      const response = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
      );

      const { puuid } = response.data;

      // Sauvegarde MongoDB
      const account = await LinkedAccount.create({
        discordId,
        lolPseudo: gameName,
        tagLine,
        puuid
      });

      // Mettre en cache
      linkedCache.set(discordId, { account, timestamp: Date.now() });

      await interaction.reply({
        content: `✅ Ton compte Riot **${gameName}#${tagLine}** a été lié avec succès !\n(PUUID: \`${puuid.slice(0, 12)}...\`)`,
        ephemeral: true
      });
    } catch (err) {
      console.error(err.response?.data || err.message);
      await interaction.reply({
        content: "❌ Impossible de lier ton compte Riot. Vérifie ton pseudo et réessaie.",
        ephemeral: true
      });
    }
  }
};
