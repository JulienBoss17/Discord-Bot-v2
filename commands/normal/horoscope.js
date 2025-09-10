const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  StringSelectMenuBuilder, 
  ActionRowBuilder 
} = require('discord.js');
const fetch = require('node-fetch');
const translate = require('@vitalets/google-translate-api'); // <-- traduction stable

// Mapping français → anglais pour l'API
const SIGN_MAP = {
  'bélier': 'aries',
  'taureau': 'taurus',
  'gémeaux': 'gemini',
  'cancer': 'cancer',
  'lion': 'leo',
  'vierge': 'virgo',
  'balance': 'libra',
  'scorpion': 'scorpio',
  'sagittaire': 'sagittarius',
  'capricorne': 'capricorn',
  'verseau': 'aquarius',
  'poissons': 'pisces'
};

// Emojis pour chaque signe
const SIGN_EMOJI = {
  'bélier': '♈', 'taureau': '♉', 'gémeaux': '♊', 'cancer': '♋',
  'lion': '♌', 'vierge': '♍', 'balance': '♎', 'scorpion': '♏',
  'sagittaire': '♐', 'capricorne': '♑', 'verseau': '♒', 'poissons': '♓'
};

// Couleur pour chaque signe
const SIGN_COLOR = {
  'bélier': 0xFF5733, 'taureau': 0xFFBD33, 'gémeaux': 0x75FF33, 'cancer': 0x33FF57,
  'lion': 0x33FFBD, 'vierge': 0x33D4FF, 'balance': 0x3375FF, 'scorpion': 0x7533FF,
  'sagittaire': 0xD433FF, 'capricorne': 0xFF33A8, 'verseau': 0xFF335E, 'poissons': 0xFF3333
};

const SIGNS_FR = Object.keys(SIGN_MAP);

const LOL_PREDICTIONS = [
  "Tu feed ton jungler malgré toi aujourd’hui.",
  "Ton ulti va renverser un fight improbable.",
  "Tu voles un dragon en solo, applause irl.",
  "Ton smite sera parfait (ou pas).",
  "Teamfight épique incoming, prépare les pings."
];

const HOROSCOPES_FALLBACK = [
  "Aujourd'hui est un jour parfait pour de nouvelles aventures.",
  "Les astres t'encouragent à prendre des risques calculés.",
  "Une surprise inattendue pourrait égayer ta journée.",
  "Prends le temps de réfléchir avant de réagir."
];

// Traduction stable via Google Translate API non officielle
async function translateToFrench(text) {
  try {
    const res = await translate(text, { to: 'fr' });
    return res.text || text;
  } catch (err) {
    console.error('Erreur traduction :', err);
    return text;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('horoscope')
    .setDescription('Donne ton horoscope du jour + une prédiction gaming LoL humoristique.'),

  async execute(interaction) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('select-sign')
      .setPlaceholder('Choisis ton signe du zodiaque')
      .addOptions(SIGNS_FR.map(sign => ({
        label: `${SIGN_EMOJI[sign]} ${sign.charAt(0).toUpperCase() + sign.slice(1)}`,
        value: sign
      })));

    await interaction.reply({
      content: 'Sélectionne ton signe : ⏳',
      components: [new ActionRowBuilder().addComponents(menu)],
      ephemeral: true
    });
  },

  async handleSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'select-sign') return;

    const signFr = interaction.values[0];
    const signEn = SIGN_MAP[signFr];
    const emoji = SIGN_EMOJI[signFr];
    const color = SIGN_COLOR[signFr] || 0xFFD700;

    await interaction.update({ content: `Récupération de l'horoscope pour ${signFr}… ⏳`, components: [] });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${signEn}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      const json = await res.json();
      const horoscopeText = json.data?.horoscope_data || HOROSCOPES_FALLBACK[Math.floor(Math.random() * HOROSCOPES_FALLBACK.length)];
      const horoscope = await translateToFrench(horoscopeText);

      const gaming = LOL_PREDICTIONS[Math.floor(Math.random() * LOL_PREDICTIONS.length)];

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(`${emoji} Horoscope du jour – ${signFr.charAt(0).toUpperCase() + signFr.slice(1)}`)
        .addFields(
          { name: '🔮 Sérieux (Amour / Travail / Chance)', value: horoscope },
          { name: '🎮 Prédiction gaming (LoL - fun)', value: gaming }
        )
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embed] });

    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: '❌ Impossible de récupérer l’horoscope (API lente ou indisponible).',
        embeds: []
      });
    }
  }
};
