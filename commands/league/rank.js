const { SlashCommandBuilder } = require("@discordjs/builders");
const { getSummonerByName, getRankBySummonerId } = require("../../utils/riotApi");
const { requireLinked } = require("../../utils/requireLinked");

const rankCache = new Map();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Affiche le rang LoL d'un joueur")
    .addStringOption(opt => opt.setName("pseudo").setDescription("Pseudo LoL").setRequired(false)),

  async execute(interaction) {
    // Middleware automatique
    let pseudo = interaction.options.getString("pseudo");
    if (!pseudo) {
      pseudo = await requireLinked(interaction);
      if (!pseudo) return; // Middleware a déjà répondu
    }

    // Vérifier cache Riot
    const cached = rankCache.get(pseudo);
    const now = Date.now();
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return interaction.reply({ content: `📊 (Cache) ${cached.rank}`, ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const summoner = await getSummonerByName(pseudo);
      const ranks = await getRankBySummonerId(summoner.id);
      const soloq = ranks.find(r => r.queueType === "RANKED_SOLO_5x5");

      const rankString = soloq
        ? `${pseudo} est **${soloq.tier} ${soloq.rank}** (${soloq.leaguePoints} LP)`
        : `${pseudo} n’a pas de rank en SoloQ.`;

      rankCache.set(pseudo, { timestamp: now, rank: rankString });
      await interaction.editReply(rankString);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Impossible de récupérer les infos du joueur.");
    }
  },
};
