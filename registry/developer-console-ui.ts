export interface ConsoleScreen {
  id: string;
  title: string;
  route: string;
  description: string;
  action?: string;
}

export const CONSOLE_SCREENS: ConsoleScreen[] = [
  { id: 'home', title: 'Command Center', route: '/console', description: 'Portfolio, deployments, usage, revenue and recommended next actions.' },
  { id: 'new-app', title: 'Create an App', route: '/console/new', description: 'Turn an idea into an IZAKHONO application.', action: 'create-app' },
  { id: 'apps', title: 'My Apps', route: '/console/apps', description: 'Manage applications, services and lifecycle stages.' },
  { id: 'build', title: 'Build Studio', route: '/console/build', description: 'Build with code, visual tools and governed AI assistance.' },
  { id: 'deploy', title: 'Deploy', route: '/console/deploy', description: 'Preview, verify and prepare controlled releases.' },
  { id: 'marketplace', title: 'Marketplace', route: '/console/marketplace', description: 'Buy and sell apps, APIs, components, templates and agents.' },
  { id: 'commerce', title: 'Commerce', route: '/console/commerce', description: 'Configure products, subscriptions, usage and entitlements.' },
  { id: 'money', title: 'Money', route: '/console/money', description: 'View commercial events, fees and developer proceeds.' },
  { id: 'growth', title: 'Growth', route: '/console/growth', description: 'Distribution, discovery, analytics and customer growth.' },
  { id: 'security', title: 'Trust & Security', route: '/console/security', description: 'Verification, security evidence and risk controls.' },
  { id: 'ai', title: 'AI Control', route: '/console/ai', description: 'Models, agents, policies, evaluation and AI usage.' },
];

export const ONBOARDING_STEPS = [
  { id: 'account', title: 'Create your developer identity' },
  { id: 'idea', title: 'Describe what you want to build' },
  { id: 'stack', title: 'Choose capabilities' },
  { id: 'preview', title: 'Generate a controlled preview' },
  { id: 'verify', title: 'Verify the application' },
  { id: 'deploy', title: 'Prepare deployment' },
  { id: 'monetize', title: 'Choose how it earns' },
];

export function consoleWelcome(name = 'Builder') {
  return {
    headline: 'Build your business on IZAKHONO.',
    subheadline: 'One account. One control centre. Many applications.',
    greeting: `Welcome, ${name}.`,
    firstAction: '/console/new',
  };
}
