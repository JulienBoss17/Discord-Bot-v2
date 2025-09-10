const mongoose = require("../utils/mongo");

const linkedAccountSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  lolPseudo: { type: String, required: true },
  tagLine: { type: String, required: true },
  puuid: { type: String, required: true },

  // Ajouts pour suivi
  lastRank: { type: String, default: null },      // ex: GOLD IV
  inGame: { type: Boolean, default: false },      // true si en game
  lastMatchId: { type: String, default: null }    // dernier match posté
}, { timestamps: true });

module.exports = mongoose.model("linkedaccounts", linkedAccountSchema);
