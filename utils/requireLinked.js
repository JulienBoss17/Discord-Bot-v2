// utils/requireLinked.js
const LinkedAccount = require("../models/LinkedAccount");

async function requireLinked(interaction) {
  const discordId = interaction.user.id;

  const account = await LinkedAccount.findOne({ discordId });
  if (!account) {
    await interaction.reply({
      content: "❌ Tu dois d’abord lier ton compte Riot avec `/link Pseudo#Tag`.",
      ephemeral: true
    });
    return null;
  }

  return account; // renvoie l'objet complet { discordId, lolPseudo, tagLine, puuid }
}

module.exports = { requireLinked };
