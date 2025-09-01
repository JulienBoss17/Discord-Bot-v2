const LinkedAccount = require('../models/LinkedAccount');

// Cache central
const linkedCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function requireLinked(interaction) {
  const discordId = interaction.user.id;

  // Vérifier cache
  const cached = linkedCache.get(discordId);
  const now = Date.now();
  if (cached && now - cached.timestamp < CACHE_DURATION) {
    return cached.pseudo;
  }

  // Vérifier MongoDB
  const linked = await LinkedAccount.findOne({ discordId });
  if (!linked) {
    await interaction.reply({
      content: "❌ Tu n'as pas lié ton compte. Utilise `/link <pseudo>`.",
      ephemeral: true
    });
    return null;
  }

  // Mettre à jour le cache
  linkedCache.set(discordId, { pseudo: linked.lolPseudo, timestamp: now });
  return linked.lolPseudo;
}

module.exports = { requireLinked, linkedCache };
