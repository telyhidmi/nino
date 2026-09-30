// Neutral charcoal surfaces, restrained pink-red accent (TikTok/Instagram-inspired).
export const media = {
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.82)',
  scrim: 'rgba(10,10,12,0.62)',
  scrimStrong: 'rgba(10,10,12,0.86)',
  hairline: 'rgba(255,255,255,0.10)',
  black: '#0A0A0B',
};

const palette = {
  bgTop: '#0E0E10',
  bgBottom: '#141416',
  card: '#1A1A1D',
  cardSoft: '#151517',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.22)',
  accent: '#FE2C55',
  accentDeep: '#E0244A',
  accentGlow: 'rgba(254,44,85,0)', // glow intentionally disabled
  accentWash: 'rgba(254,44,85,0.10)',
  onAccent: '#FFFFFF',
  text: '#F5F5F6',
  secondary: '#A1A1A8',
  muted: '#6B6B73',
  danger: '#FF4D5E',
  dangerWash: 'rgba(255,77,94,0.12)',
  overlay: media.scrimStrong,
  // scaffold aliases
  background: '#0E0E10',
  foreground: '#F5F5F6',
  primary: '#FE2C55',
  primaryForeground: '#FFFFFF',
  mutedForeground: '#A1A1A8',
};

const colors = {
  light: palette,
  dark: palette,
  radius: { input: 12, card: 14, pill: 999 },
};

export type Palette = typeof palette;
export default colors;
