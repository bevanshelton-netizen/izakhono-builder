export interface DeveloperConsoleModule {
  id: string;
  name: string;
  purpose: string;
  routes: string[];
  ecosystemServices: string[];
}

export const DEVELOPER_CONSOLE_MODULES: DeveloperConsoleModule[] = [
  { id: 'home', name: 'Command Center', purpose: 'Portfolio health, deployments, usage, revenue and actions.', routes: ['/console'], ecosystemServices: ['analytics'] },
  { id: 'build', name: 'Build Studio', purpose: 'Create and modify applications with visual, code and AI workflows.', routes: ['/console/build','/console/build/:appId'], ecosystemServices: ['cloud','ai'] },
  { id: 'apps', name: 'My Apps', purpose: 'Register, configure, verify and manage applications.', routes: ['/console/apps','/console/apps/:appId'], ecosystemServices: ['identity','trust'] },
  { id: 'deploy', name: 'Deployments', purpose: 'Preview, release, domains, TLS, observability and recovery.', routes: ['/console/deployments'], ecosystemServices: ['cloud','trust'] },
  { id: 'apis', name: 'API Hub', purpose: 'Publish, consume and govern APIs.', routes: ['/console/apis'], ecosystemServices: ['cloud','marketplace'] },
  { id: 'marketplace', name: 'Marketplace', purpose: 'Discover and sell apps, APIs, components, templates and agents.', routes: ['/console/marketplace'], ecosystemServices: ['marketplace','distribution'] },
  { id: 'commerce', name: 'Commerce', purpose: 'Products, pricing, subscriptions, usage and entitlements.', routes: ['/console/commerce'], ecosystemServices: ['commerce','payments'] },
  { id: 'money', name: 'Money', purpose: 'Revenue, platform fees, refunds, payouts and commercial events.', routes: ['/console/money'], ecosystemServices: ['payments','analytics'] },
  { id: 'growth', name: 'Growth', purpose: 'Discovery, SEO, referrals, campaigns, affiliates and analytics.', routes: ['/console/growth'], ecosystemServices: ['growth','distribution','analytics'] },
  { id: 'trust', name: 'Trust & Security', purpose: 'Verification, security evidence, fraud controls and disputes.', routes: ['/console/trust'], ecosystemServices: ['trust'] },
  { id: 'ai', name: 'AI Control', purpose: 'Models, agents, usage, policies and evaluation.', routes: ['/console/ai'], ecosystemServices: ['ai'] },
  { id: 'settings', name: 'Developer Settings', purpose: 'Identity, teams, keys, permissions, exports and integrations.', routes: ['/console/settings'], ecosystemServices: ['identity'] },
];

export const DEVELOPER_JOURNEY = [
  'create-account',
  'create-app',
  'choose-stack',
  'build',
  'preview',
  'verify',
  'deploy',
  'connect-commerce',
  'publish',
  'grow',
  'scale',
];

export function consoleNavigation(): DeveloperConsoleModule[] {
  return DEVELOPER_CONSOLE_MODULES.slice();
}
