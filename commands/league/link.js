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

    await interaction.deferReply({ flags: 64 }); // ✅ plus de warning

    // Vérifier si l'utilisateur a déjà lié un compte
    const existingAccount = await LinkedAccount.findOne({ discordId });
    if (existingAccount) {
      return interaction.editReply("❌ Tu as déjà lié un compte Riot.");
    }

    // Vérif pseudo complet
    if (!fullPseudo.includes("#")) {
      return interaction.editReply("❌ Merci de fournir ton pseudo complet : `Pseudo#Tag`.");
    }

    const [gameName, tagLine] = fullPseudo.split("#");

    try {
      // 🔹 Vérifier que Riot renvoie bien un compte
      const response = await axios.get(
        `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}?api_key=${RIOT_API_KEY}`
      );

      if (!response.data?.puuid) {
        return interaction.editReply("❌ Riot n'a pas trouvé ce pseudo. Vérifie l'orthographe !");
      }

      const { puuid } = response.data;

      // Sauvegarde en DB
      const account = await LinkedAccount.create({
        discordId,
        lolPseudo: gameName,
        tagLine,
        puuid
      });

      // Cache
      linkedCache.set(discordId, { account, timestamp: Date.now() });

      return interaction.editReply(
        `✅ Ton compte Riot **${gameName}#${tagLine}** a été lié avec succès !\n(PUUID: \`${puuid.slice(0, 12)}...\`)`
      );

    } catch (err) {
      console.error("Erreur Riot API:", err.response?.data || err.message);

      // Message plus clair selon le cas
      if (err.response?.status === 403) {
        return interaction.editReply("❌ Ta clé Riot API est invalide ou expirée.");
      }
      if (err.response?.status === 404) {
        return interaction.editReply("❌ Pseudo Riot introuvable.");
      }

      return interaction.editReply("❌ Erreur inconnue, réessaie plus tard.");
    }
  }
};
