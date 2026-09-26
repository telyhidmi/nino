const palette = {
  bgTop: '#0B1A1F',
  bgBottom: '#0F2A30',
  card: '#15262B',
  cardSoft: '#112127',
  border: 'rgba(31,224,232,0.25)',
  borderStrong: 'rgba(31,224,232,0.6)',
  accent: '#1FE0E8',
  accentDeep: '#0FB5BE',
  accentGlow: 'rgba(31,224,232,0.35)',
  accentWash: 'rgba(31,224,232,0.10)',
  onAccent: '#062126',
  text: '#FFFFFF',
  secondary: '#9FB3B8',
  muted: '#5F777D',
  danger: '#FF3B4A',
  dangerWash: 'rgba(255,59,74,0.12)',
  overlay: 'rgba(5,14,17,0.82)',
  // scaffold aliases
  background: '#0B1A1F',
  foreground: '#FFFFFF',
  primary: '#1FE0E8',
  primaryForeground: '#062126',
  mutedForeground: '#9FB3B8',
};

const colors = {
  light: palette,
  dark: palette,
  radius: { input: 14, card: 18, pill: 999 },
};

export type Palette = typeof palette;
export default colors;
