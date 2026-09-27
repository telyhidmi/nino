export type SampleComment = { id: string; author: string; flag: string; text: string; translation?: string };
export type SamplePost = {
  id: string;
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

export const FEED_IMAGE = require('@/assets/images/feed-rio.jpg');

export const SAMPLE_POSTS: SamplePost[] = [
  {
    id: 'rio-isabela',
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
    id: 'rio-sunset',
    author: 'Isabela Souza',
    handle: 'isa.viaja',
    countryCode: 'BRA',
    flag: '🇧🇷',
    location: 'Arpoador, Rio de Janeiro',
    langPair: 'PT-BR ⇄ AR',
    caption: 'Pôr do sol no Arpoador: aqui todo mundo aplaude o sol. ☀️',
    translation: 'Sunset at Arpoador: here everyone applauds the sun. ☀️',
    music: 'Mas Que Nada • Sample track',
    likes: 48730,
    commentCount: 912,
    shares: 367,
    following: true,
    tags: ['sunset', 'brazil', 'traditions'],
    comments: [
      { id: 'c4', author: 'Amira Saleh', flag: '🇪🇬', text: 'Clapping for the sun? I love this tradition.' },
    ],
    translations: [
      { code: 'en', label: 'English', text: 'Sunset at Arpoador: here everyone applauds the sun.' },
      { code: 'ar', label: 'العربية', text: 'غروب الشمس في أربوادور: هنا الجميع يصفق للشمس.' },
    ],
  },
];

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
