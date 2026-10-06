import type { ImageSourcePropType } from 'react-native';

export type SampleComment = { id: string; author: string; flag: string; text: string; translation?: string; isViewer?: boolean };
export type SamplePost = {
  id: string;
  image: ImageSourcePropType;
  video?: number;
  videoWeb?: number;
  videoHasAudio?: boolean;
  videoCredit?: string;
  videoSourceUrl?: string;
  author: string;
  handle: string;
  countryCode: string;
  flag: string;
  location: string;
  langPair: string;
  caption: string;
  translation: string;
  music: string;
  likes: number;
  comments: SampleComment[];
  commentCount: number;
  shares: number;
  translations: { code: string; label: string; text: string }[];
  following: boolean;
  tags: string[];
};

export const SAMPLE_POSTS: SamplePost[] = [
  {
    id: 'rio-isabela',
    image: require('@/assets/images/feed-rio-scenic.jpg'),
    video: require('@/assets/videos/italy.mp4'),
    videoWeb: require('@/assets/videos/italy.webm'),
    videoHasAudio: true,
    videoCredit: 'E.Guggenbichler · CC BY-SA 4.0 · Wikimedia Commons',
    videoSourceUrl: 'https://commons.wikimedia.org/wiki/File:Seaside_Italy_Video.webm',
    author: 'Isabela Souza',
    handle: 'isa.viaja',
    countryCode: 'BRA',
    flag: '🇧🇷',
    location: 'Italian coast · sample footage',
    langPair: 'PT-BR ⇄ EN',
    caption: 'Um momento à beira-mar. Que vontade de viajar! 🌊',
    translation: 'A moment by the sea. Makes me want to travel! 🌊',
    music: 'Sample footage · Italian coast',
    likes: 125400,
    commentCount: 4200,
    shares: 1100,
    following: false,
    tags: ['beach', 'italy', 'coast', 'sea'],
    comments: [
      { id: 'c1', author: 'Kenji Mori', flag: '🇯🇵', text: '海に行ってみたい！景色が最高です。', translation: 'I want to visit the sea! The view is amazing.' },
      { id: 'c2', author: 'Layla Haddad', flag: '🇸🇦', text: 'منظر رائع! أحب البحر.', translation: 'Amazing view! I love the sea.' },
      { id: 'c3', author: 'Mateo Ruiz', flag: '🇪🇸', text: '¡Qué energía tan bonita, Isa!', translation: 'Such beautiful energy, Isa!' },
    ],
    translations: [
      { code: 'en', label: 'English', text: 'A moment by the sea. Makes me want to travel!' },
      { code: 'ar', label: 'العربية', text: 'لحظة على شاطئ البحر. تجعلني أرغب في السفر!' },
      { code: 'es', label: 'Español', text: 'Un momento junto al mar. ¡Qué ganas de viajar!' },
      { code: 'ja', label: '日本語', text: '海辺のひととき。旅に出たくなる！' },
    ],
  },
  {
    id: 'kyoto-kenji',
    image: require('@/assets/images/feed-kyoto.jpg'),
    video: require('@/assets/videos/falls.mp4'),
    videoWeb: require('@/assets/videos/falls.webm'),
    videoHasAudio: true,
    videoCredit: 'Farai Gandiya · CC BY-SA 4.0 · Wikimedia Commons',
    videoSourceUrl: 'https://commons.wikimedia.org/wiki/File:Victoria-falls.webm',
    author: 'Kenji Mori',
    handle: 'kenji.walks',
    countryCode: 'JPN',
    flag: '🇯🇵',
    location: 'Victoria Falls · sample footage',
    langPair: 'JA ⇄ EN',
    caption: '滝の流れを見ていると、時間を忘れます。💧',
    translation: 'Watching the waterfall makes me lose track of time. 💧',
    music: 'Sample footage · Victoria Falls',
    likes: 48730,
    commentCount: 912,
    shares: 367,
    following: true,
    tags: ['waterfall', 'victoria falls', 'nature'],
    comments: [
      { id: 'c4', author: 'Amira Saleh', flag: '🇪🇬', text: 'The waterfall looks beautiful!' },
    ],
    translations: [
      { code: 'en', label: 'English', text: 'Watching the waterfall makes me lose track of time.' },
      { code: 'ar', label: 'العربية', text: 'عندما أشاهد الشلال أنسى مرور الوقت.' },
    ],
  },
  {
    id: 'santorini-eleni',
    image: require('@/assets/images/feed-santorini.jpg'),
    video: require('@/assets/videos/peony.mp4'),
    videoWeb: require('@/assets/videos/peony.webm'),
    videoHasAudio: false,
    videoCredit: 'Zuzka Slaninková · CC BY 3.0 · Wikimedia Commons',
    videoSourceUrl: 'https://commons.wikimedia.org/wiki/File:Time_lapse_of_Peony_flower_blooming.webm',
    author: 'Eleni Papadopoulos',
    handle: 'eleni.travels',
    countryCode: 'GRC',
    flag: '🇬🇷',
    location: 'Peony bloom · location unspecified',
    langPair: 'EL ⇄ EN',
    caption: 'Μια παιώνια ανθίζει σε λίγα δευτερόλεπτα. 🌸',
    translation: 'A peony blooms in just a few seconds. 🌸',
    music: 'Silent sample footage · Peony time-lapse',
    likes: 32800,
    commentCount: 526,
    shares: 184,
    following: false,
    tags: ['flower', 'peony', 'nature', 'timelapse'],
    comments: [{ id: 'c5', author: 'Mateo Ruiz', flag: '🇪🇸', text: '¡Qué flor tan bonita!', translation: 'What a beautiful flower!' }],
    translations: [
      { code: 'en', label: 'English', text: 'A peony blooms in just a few seconds.' },
      { code: 'es', label: 'Español', text: 'Una peonía florece en solo unos segundos.' },
    ],
  },
  {
    id: 'venice-matteo',
    image: require('@/assets/images/feed-venice.jpg'),
    author: 'Matteo Bianchi',
    handle: 'matteo.in.motion',
    countryCode: 'ITA',
    flag: '🇮🇹',
    location: 'Venice, Italy',
    langPair: 'IT ⇄ EN',
    caption: 'Ogni ponte nasconde una nuova storia. Perdiamoci tra i canali! 🚣',
    translation: 'Every bridge hides a new story. Let’s get lost among the canals! 🚣',
    music: 'Canal stroll • Demo soundtrack',
    likes: 71900,
    commentCount: 1340,
    shares: 502,
    following: false,
    tags: ['italy', 'venice', 'canals', 'architecture'],
    comments: [{ id: 'c6', author: 'Isabela Souza', flag: '🇧🇷', text: 'Que lugar lindo!', translation: 'What a beautiful place!' }],
    translations: [
      { code: 'en', label: 'English', text: 'Every bridge hides a new story. Let’s get lost among the canals!' },
      { code: 'pt', label: 'Português', text: 'Cada ponte esconde uma nova história. Vamos nos perder pelos canais!' },
    ],
  },
  {
    id: 'tokyo-aiko',
    image: require('@/assets/images/feed-tokyo.jpg'),
    author: 'Aiko Tanaka',
    handle: 'aiko.citylights',
    countryCode: 'JPN',
    flag: '🇯🇵',
    location: 'Tokyo, Japan',
    langPair: 'JA ⇄ EN',
    caption: '雨上がりの街は、光が反射してまるで映画のワンシーンみたい。🌃',
    translation: 'After the rain, the city lights reflect like a scene from a movie. 🌃',
    music: 'City lights • Demo soundtrack',
    likes: 56200,
    commentCount: 783,
    shares: 291,
    following: false,
    tags: ['japan', 'tokyo', 'city', 'night'],
    comments: [{ id: 'c7', author: 'Eleni Papadopoulos', flag: '🇬🇷', text: 'This city never stops glowing!' }],
    translations: [
      { code: 'en', label: 'English', text: 'After the rain, the city lights reflect like a scene from a movie.' },
      { code: 'es', label: 'Español', text: 'Después de la lluvia, las luces de la ciudad se reflejan como en una película.' },
    ],
  },
];

export function compact(n: number, locale?: string) {
  if (locale) return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
