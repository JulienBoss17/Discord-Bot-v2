const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI; // Mets ton URI Atlas dans le .env

if (!MONGO_URI) {
  console.error("❌ MONGO_URI non défini dans le .env");
  process.exit(1);
}

mongoose.connect(MONGO_URI);

mongoose.connection.on("connected", () => {
  console.log("✅ Connecté à MongoDB Atlas");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Erreur MongoDB :", err);
});

module.exports = mongoose;
