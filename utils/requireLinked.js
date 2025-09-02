const NodeCache = require("node-cache");
const LinkedAccount = require("../models/LinkedAccount");

const linkedCache = new NodeCache({ stdTTL: 300 }); // cache 5 minutes

async function requireLinked(interaction) {
  const discordId = interaction.user.id;

  if (linkedCache.has(discordId)) {
    return linkedCache.get(discordId).account;
  }

  const account = await LinkedAccount.findOne({ discordId });
  if (!account) {
    await interaction.reply({
      content: "❌ Tu dois d’abord lier ton compte Riot avec `/link Pseudo#Tag`.",
      flags: 64 // ephemeral
    });
    return null;
  }

  linkedCache.set(discordId, { account, timestamp: Date.now() });
  return account;
}

module.exports = { requireLinked, linkedCache };
