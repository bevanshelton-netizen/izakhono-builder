export type VisualProfileName = 'cinematic-glass' | 'semantic-static';

export interface VisualProfile {
  name: VisualProfileName;
  webgl: 'progressive' | 'off';
  motion: 'adaptive' | 'reduced';
  glass: 'soft' | 'medium' | 'strong' | 'off';
  liquidLogo: boolean;
  fallback: 'semantic-static';
}

const PROFILES: Record<VisualProfileName, VisualProfile> = {
  'cinematic-glass': {
    name: 'cinematic-glass',
    webgl: 'progressive',
    motion: 'adaptive',
    glass: 'medium',
    liquidLogo: true,
    fallback: 'semantic-static',
  },
  'semantic-static': {
    name: 'semantic-static',
    webgl: 'off',
    motion: 'reduced',
    glass: 'off',
    liquidLogo: false,
    fallback: 'semantic-static',
  },
};

export function resolveVisualProfile(name: VisualProfileName = 'cinematic-glass'): VisualProfile {
  return PROFILES[name] ?? PROFILES['semantic-static'];
}

export function visualProfileNames(): VisualProfileName[] {
  return Object.keys(PROFILES) as VisualProfileName[];
}
