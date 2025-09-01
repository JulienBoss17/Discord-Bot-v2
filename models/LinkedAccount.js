const mongoose = require("../utils/mongo");

const linkedAccountSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  lolPseudo: { type: String, required: true }, // gameName (ex: Sofiaaa)
  tagLine: { type: String, required: true },   // #0000
  puuid: { type: String, required: true },     // Riot PUUID unique
}, { timestamps: true }); // ajoute createdAt / updatedAt automatiquement

module.exports = mongoose.model("LinkedAccount", linkedAccountSchema);
