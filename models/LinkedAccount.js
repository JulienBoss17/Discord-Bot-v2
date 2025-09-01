const mongoose = require("../utils/mongo");

const linkedAccountSchema = new mongoose.Schema({
  discordId: { type: String, required: true, unique: true },
  lolPseudo: { type: String, required: true },
});

module.exports = mongoose.model("LinkedAccount", linkedAccountSchema);
