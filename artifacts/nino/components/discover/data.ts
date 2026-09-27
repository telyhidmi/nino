import type { ImageSourcePropType } from 'react-native';
import { SAMPLE_POSTS } from '@/components/feed/data';

export type DiscoverMedia =
  | { id: string; kind: 'video'; postId: string; title: string; place: string; image: ImageSourcePropType }
  | { id: string; kind: 'image'; title: string; place: string; image: ImageSourcePropType };

export type DiscoverPerson = { id: string; name: string; city: string; image?: ImageSourcePropType; postId?: string };

export type DiscoverCountry = {
  id: string;
  name: string;
  flag: string;
  tagline: string;
  sampleMembers: number;
  image: ImageSourcePropType;
  tags: string[];
  people: DiscoverPerson[];
  media: DiscoverMedia[];
};

const post = (id: string) => SAMPLE_POSTS.find((p) => p.id === id)!;
const videoOf = (postId: string, title: string, place: string): DiscoverMedia => ({ id: `v-${postId}`, kind: 'video', postId, title, place, image: post(postId).image });

const IMG = {
  brazil: require('@/assets/images/discover-brazil.jpg'),
  turkiye: require('@/assets/images/discover-turkiye.jpg'),
  japan: require('@/assets/images/discover-japan.jpg'),
  spain: require('@/assets/images/discover-spain.jpg'),
  usa: require('@/assets/images/discover-usa.jpg'),
  france: require('@/assets/images/discover-france.jpg'),
  egypt: require('@/assets/images/discover-egypt.jpg'),
  food: require('@/assets/images/discover-br-food.jpg'),
  surf: require('@/assets/images/discover-br-surf.jpg'),
  carnival: require('@/assets/images/discover-br-carnival.jpg'),
};

export const COUNTRIES: DiscoverCountry[] = [
  {
    id: 'brazil', name: 'Brazil', flag: '🇧🇷', tagline: 'Vibrant people, amazing culture', sampleMembers: 1240, image: IMG.brazil,
    tags: ['beach', 'carnival', 'football', 'music', 'food', 'rio', 'south america'],
    people: [
      { id: 'isa', name: 'Isabela', city: 'Rio de Janeiro', image: post('rio-isabela').image, postId: 'rio-isabela' },
      { id: 'mat', name: 'Matheus', city: 'São Paulo' },
      { id: 'cam', name: 'Camila', city: 'Salvador' },
      { id: 'raf', name: 'Rafael', city: 'Curitiba' },
      { id: 'bea', name: 'Beatriz', city: 'Brasília' },
    ],
    media: [
      videoOf('rio-isabela', 'A moment by the sea', 'Sample clip'),
      { id: 'br-carnival', kind: 'image', title: 'Carnival colours', place: 'Rio de Janeiro', image: IMG.carnival },
      { id: 'br-surf', kind: 'image', title: 'Good waves today', place: 'Florianópolis', image: IMG.surf },
      { id: 'br-food', kind: 'image', title: 'Brazilian food', place: 'São Paulo', image: IMG.food },
      { id: 'br-rio', kind: 'image', title: 'Life in Rio', place: 'Rio de Janeiro', image: IMG.brazil },
    ],
  },
  {
    id: 'turkiye', name: 'Türkiye', flag: '🇹🇷', tagline: 'Where continents meet', sampleMembers: 910, image: IMG.turkiye,
    tags: ['istanbul', 'mosque', 'bazaar', 'tea', 'europe', 'asia'],
    people: [{ id: 'elif', name: 'Elif', city: 'Istanbul' }, { id: 'can', name: 'Can', city: 'Izmir' }, { id: 'zey', name: 'Zeynep', city: 'Ankara' }],
    media: [{ id: 'tr-ist', kind: 'image', title: 'Sunset domes', place: 'Istanbul', image: IMG.turkiye }],
  },
  {
    id: 'japan', name: 'Japan', flag: '🇯🇵', tagline: 'Old temples, neon nights', sampleMembers: 870, image: IMG.japan,
    tags: ['tokyo', 'kyoto', 'fuji', 'temple', 'sakura', 'asia'],
    people: [
      { id: 'kenji', name: 'Kenji', city: 'Kyoto', image: post('kyoto-kenji').image, postId: 'kyoto-kenji' },
      { id: 'aiko', name: 'Aiko', city: 'Tokyo', image: post('tokyo-aiko').image, postId: 'tokyo-aiko' },
      { id: 'yuki', name: 'Yuki', city: 'Osaka' },
    ],
    media: [
      videoOf('kyoto-kenji', 'Lost track of time', 'Sample clip'),
      videoOf('tokyo-aiko', 'Tokyo evenings', 'Tokyo'),
      { id: 'jp-fuji', kind: 'image', title: 'Fuji in bloom', place: 'Yamanashi', image: IMG.japan },
    ],
  },
  {
    id: 'spain', name: 'Spain', flag: '🇪🇸', tagline: 'Late dinners, long light', sampleMembers: 630, image: IMG.spain,
    tags: ['barcelona', 'madrid', 'tapas', 'gaudi', 'europe'],
    people: [{ id: 'mateo', name: 'Mateo', city: 'Barcelona' }, { id: 'lucia', name: 'Lucía', city: 'Sevilla' }],
    media: [{ id: 'es-bcn', kind: 'image', title: 'Gaudí at golden hour', place: 'Barcelona', image: IMG.spain }],
  },
  {
    id: 'usa', name: 'USA', flag: '🇺🇸', tagline: 'Fifty states of stories', sampleMembers: 1120, image: IMG.usa,
    tags: ['new york', 'city', 'skyline', 'america'],
    people: [{ id: 'jordan', name: 'Jordan', city: 'New York' }, { id: 'maya', name: 'Maya', city: 'Austin' }],
    media: [{ id: 'us-nyc', kind: 'image', title: 'Harbor view', place: 'New York', image: IMG.usa }],
  },
  {
    id: 'france', name: 'France', flag: '🇫🇷', tagline: 'Cafés, cobblestones, conversation', sampleMembers: 580, image: IMG.france,
    tags: ['paris', 'eiffel', 'food', 'europe', 'art'],
    people: [{ id: 'chloe', name: 'Chloé', city: 'Paris' }, { id: 'hugo', name: 'Hugo', city: 'Lyon' }],
    media: [{ id: 'fr-par', kind: 'image', title: 'Morning in Paris', place: 'Paris', image: IMG.france }],
  },
  {
    id: 'egypt', name: 'Egypt', flag: '🇪🇬', tagline: 'Five thousand years of stories', sampleMembers: 410, image: IMG.egypt,
    tags: ['cairo', 'giza', 'pyramids', 'nile', 'desert', 'africa'],
    people: [{ id: 'omar', name: 'Omar', city: 'Cairo' }, { id: 'nour', name: 'Nour', city: 'Alexandria' }],
    media: [{ id: 'eg-giza', kind: 'image', title: 'Desert sunset', place: 'Giza', image: IMG.egypt }],
  },
];

export const countryMatches = (c: DiscoverCountry, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [c.name, c.tagline, ...c.tags, ...c.people.map((p) => `${p.name} ${p.city}`), ...c.media.map((m) => `${m.title} ${m.place}`)].join(' ').toLowerCase().includes(s);
};
