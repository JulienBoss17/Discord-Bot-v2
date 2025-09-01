const { SlashCommandBuilder } = require("@discordjs/builders");
const LinkedAccount = require("../../models/LinkedAccount");
const { linkedCache } = require("../../utils/requireLinked");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("link")
    .setDescription("Associe ton compte Discord à ton pseudo LoL")
    .addStringOption(opt =>
      opt.setName("pseudo")
         .setDescription("Ton pseudo LoL")
         .setRequired(true)
    ),

  async execute(interaction) {
    const pseudo = interaction.options.getString("pseudo");
    const discordId = interaction.user.id;

    try {
      // Mettre à jour MongoDB
      await LinkedAccount.findOneAndUpdate(
        { discordId },
        { lolPseudo: pseudo },
        { upsert: true, new: true }
      );

      // Mettre à jour le cache central
      linkedCache.set(discordId, { pseudo, timestamp: Date.now() });

      await interaction.reply({ 
        content: `✅ Ton pseudo LoL **${pseudo}** a été lié à ton compte Discord.`,
        ephemeral: true
      });
    } catch (err) {
      console.error(err);
      await interaction.reply({
        content: "❌ Une erreur est survenue lors de la liaison.",
        ephemeral: true
      });
    }
  },
};
