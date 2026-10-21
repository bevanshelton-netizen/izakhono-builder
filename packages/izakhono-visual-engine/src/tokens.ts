export const visualTokens = {
  profile: 'cinematic-glass',
  colors: {
    ink: '#05070b',
    glass: 'rgba(255,255,255,0.08)',
    glassStrong: 'rgba(255,255,255,0.14)',
    border: 'rgba(255,255,255,0.18)',
    text: '#f7f8fb',
    muted: 'rgba(247,248,251,0.68)',
  },
  radius: { sm: 12, md: 20, lg: 32, pill: 999 },
  motion: { fast: 160, normal: 320, slow: 720 },
  performance: {
    enableWebGL: true,
    maxPixelRatio: 1.75,
    disableOnSaveData: true,
  },
} as const;

export type VisualProfile = 'cinematic-glass';
