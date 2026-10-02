export type EcosystemService =
  | 'identity' | 'cloud' | 'ai' | 'commerce' | 'payments' | 'trust'
  | 'distribution' | 'growth' | 'marketplace' | 'analytics' | 'communications';

export interface EcosystemBundle {
  id: string;
  name: string;
  services: EcosystemService[];
  value: string;
  portability: boolean;
}

export const ECOSYSTEM_BUNDLES: EcosystemBundle[] = [
  { id: 'build', name: 'Build Core', services: ['identity','cloud','ai','analytics'], value: 'Build, test and observe apps faster.', portability: true },
  { id: 'launch', name: 'Launch Core', services: ['identity','cloud','trust','distribution'], value: 'Ship verified applications with operational controls.', portability: true },
  { id: 'monetize', name: 'Monetize Core', services: ['identity','commerce','payments','analytics'], value: 'Sell subscriptions, usage and products through governed rails.', portability: true },
  { id: 'grow', name: 'Growth Core', services: ['distribution','growth','analytics','communications'], value: 'Acquire, retain and understand customers.', portability: true },
  { id: 'scale', name: 'Scale Core', services: ['cloud','ai','trust','communications','marketplace'], value: 'Operate larger teams, workloads and ecosystems.', portability: true },
];

export function ecosystemValueScore(adopted: EcosystemService[]): number {
  const unique = new Set(adopted);
  return Math.min(100, unique.size * 8);
}

export function dependencyDisclosure(adopted: EcosystemService[]): {
  services: EcosystemService[];
  portable: true;
  migrationSupported: true;
} {
  return { services: Array.from(new Set(adopted)), portable: true, migrationSupported: true };
}
