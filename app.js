require("dotenv").config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder } = require("discord.js");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");
const fs = require("fs");
const path = require("path");
const { formatDistanceToNow } = require('date-fns');
const { fr } = require('date-fns/locale');
const LinkedAccount = require("./models/LinkedAccount");
const { requireLinked } = require("./utils/requireLinked");
const { InteractionResponseFlags } = require('discord-api-types/v10');
const checkRanks = require("./utils/checkRanks");
const checkMatches = require("./utils/checkMatches");

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

if (!token || !clientId || !guildId) {
  console.error("❌ Vérifie que TOKEN, CLIENT_ID et GUILD_ID sont bien définis dans ton .env");
  process.exit(1);
}

// --- Initialisation du bot ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
const commands = [];

// --- Fonction récursive pour récupérer tous les fichiers de commandes ---
function getAllCommandFiles(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getAllCommandFiles(fullPath));
    } else if (file.endsWith(".js")) {
      files.push(fullPath);
    }
  });
  return files;
}

// --- Chargement des commandes ---
const commandsPath = path.join(__dirname, "commands");
const commandFiles = getAllCommandFiles(commandsPath);

for (const file of commandFiles) {
  const command = require(file);
  if (command.data) {
    commands.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`⚠️ La commande ${file} ne contient pas 'data'.`);
  }
}


// --- Enregistrement des commandes auprès de Discord ---
const rest = new REST({ version: "9" }).setToken(token);

(async () => {
  try {
    console.log("✅ Enregistrement des commandes slash...");
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log("✅ Commandes enregistrées avec succès!");
  } catch (error) {
    console.error("❌ Erreur enregistrement commandes :", error);
  }
})();

// --- Événements de bienvenue et départ ---
client.on('guildMemberAdd', async (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === '🛖bienvenue');
  if (!channel) return;

  const { name, memberCount } = member.guild;
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x1E2A78)
    .setDescription(`Tu as rejoint le **Serveur de Julien** !🫡\nServeur chill et détendu pour jouer ensemble 🙏`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: '📊 Infos Serveur', value: `Nom : ${name}\nMembres : ${memberCount}`, inline: false })
    .setFooter({ text: 'Forge ta légende, invocateur !' })
    .setTimestamp();

  channel.send({ content: `⚔️ Bienvenue ${member}!`, embeds: [welcomeEmbed] });
});

client.on('guildMemberRemove', async (member) => {
  const channel = member.guild.channels.cache.find(ch => ch.name === '🛖bienvenue');
  if (!channel) return;

  const timeAgo = formatDistanceToNow(member.joinedAt, { addSuffix: true, locale: fr });
  const leaveEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle(`🚪 ${member.user.tag} a quitté le serveur`)
    .setThumbnail(member.user.displayAvatarURL())
    .setDescription(`Cet utilisateur avait rejoint le serveur **${timeAgo}**.`)
    .addFields({ name: 'À la prochaine, peut-être...', value: "", inline: false })
    .setTimestamp();

  channel.send({ embeds: [leaveEmbed] });
});

// --- Exécution des commandes avec middleware pour LoL ---
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Middleware automatique pour toutes les commandes LoL
if (command.lolCommand) {
  const account = await requireLinked(interaction);
  if (!account) return; // Middleware a déjà répondu si non lié
  interaction.riotAccount = account; // stocker l'objet complet
}


  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "",
      flags: InteractionResponseFlags.ephemeral
    });
  }
});

// --- Scheduler automatique ---
client.once("clientReady", () => {
  console.log(`🚀 Bot prêt en tant que ${client.user.tag}`);

  // Rank check : toutes les 30 minutes
  setInterval(() => checkRanks(client), 30 * 60 * 1000);

  // Match history check : toutes les 2 minutes
  setInterval(() => checkMatches(client), 2 * 60 * 1000);
});


// --- Lancement du bot ---
client.login(token)
  .then(() => console.log(`✅ Connecté en tant que ${client.user.tag}`))
  .catch(err => {
    console.error("❌ Erreur lors de la connexion au bot:", err);
    process.exit(1);
  });
