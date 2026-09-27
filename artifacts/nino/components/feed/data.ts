import type { ImageSourcePropType } from 'react-native';

export type SampleComment = { id: string; author: string; flag: string; text: string; translation?: string };
export type SamplePost = {
  id: string;
  image: ImageSourcePropType;
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
    author: 'Isabela Souza',
    handle: 'isa.viaja',
    countryCode: 'BRA',
    flag: '🇧🇷',
    location: 'Rio de Janeiro, Brazil',
    langPair: 'PT-BR ⇄ EN',
    caption: 'A vida é mais bonita quando conhecemos novas culturas! 🌎💚',
    translation: 'Life is more beautiful when we get to know new cultures! 🌎💚',
    music: 'Som original - Isabela Souza • Garota de Ipanema',
    likes: 125400,
    commentCount: 4200,
    shares: 1100,
    following: false,
    tags: ['beach', 'brazil', 'culture'],
    comments: [
      { id: 'c1', author: 'Kenji Mori', flag: '🇯🇵', text: 'リオに行ってみたい！景色が最高です。', translation: 'I want to go to Rio! The view is amazing.' },
      { id: 'c2', author: 'Layla Haddad', flag: '🇸🇦', text: 'منظر رائع! أين هذا المكان بالضبط؟', translation: 'Amazing view! Where exactly is this place?' },
      { id: 'c3', author: 'Mateo Ruiz', flag: '🇪🇸', text: '¡Qué energía tan bonita, Isa!', translation: 'Such beautiful energy, Isa!' },
    ],
    translations: [
      { code: 'en', label: 'English', text: 'Life is more beautiful when we get to know new cultures!' },
      { code: 'ar', label: 'العربية', text: 'الحياة أجمل عندما نتعرف على ثقافات جديدة!' },
      { code: 'es', label: 'Español', text: '¡La vida es más bonita cuando conocemos nuevas culturas!' },
      { code: 'ja', label: '日本語', text: '新しい文化を知ると、人生はもっと美しくなる！' },
    ],
  },
  {
    id: 'kyoto-kenji',
    image: require('@/assets/images/feed-kyoto.jpg'),
    author: 'Kenji Mori',
    handle: 'kenji.walks',
    countryCode: 'JPN',
    flag: '🇯🇵',
    location: 'Higashiyama, Kyoto',
    langPair: 'JA ⇄ EN',
    caption: '夕暮れの京都。古い路地を歩くと、時間がゆっくり流れる気がします。🏮',
    translation: 'Kyoto at dusk. In these old lanes, time seems to slow down. 🏮',
    music: 'Evening walk • Demo soundtrack',
    likes: 48730,
    commentCount: 912,
    shares: 367,
    following: true,
    tags: ['kyoto', 'japan', 'streets', 'culture'],
    comments: [
      { id: 'c4', author: 'Amira Saleh', flag: '🇪🇬', text: 'Those lantern-lit streets look beautiful!' },
    ],
    translations: [
      { code: 'en', label: 'English', text: 'Kyoto at dusk. In these old lanes, time seems to slow down.' },
      { code: 'ar', label: 'العربية', text: 'كيوتو عند الغسق. في هذه الأزقة القديمة يبدو أن الوقت يمر ببطء.' },
    ],
  },
  {
    id: 'santorini-eleni',
    image: require('@/assets/images/feed-santorini.jpg'),
    author: 'Eleni Papadopoulos',
    handle: 'eleni.travels',
    countryCode: 'GRC',
    flag: '🇬🇷',
    location: 'Santorini, Greece',
    langPair: 'EL ⇄ EN',
    caption: 'Το φως του Αιγαίου κάνει κάθε γωνιά να μοιάζει με καρτ ποστάλ. 💙',
    translation: 'The Aegean light makes every corner look like a postcard. 💙',
    music: 'Aegean afternoon • Demo soundtrack',
    likes: 32800,
    commentCount: 526,
    shares: 184,
    following: false,
    tags: ['greece', 'santorini', 'island', 'sea'],
    comments: [{ id: 'c5', author: 'Mateo Ruiz', flag: '🇪🇸', text: '¡Qué azul tan bonito!', translation: 'What a beautiful blue!' }],
    translations: [
      { code: 'en', label: 'English', text: 'The Aegean light makes every corner look like a postcard.' },
      { code: 'es', label: 'Español', text: 'La luz del Egeo hace que cada rincón parezca una postal.' },
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

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
