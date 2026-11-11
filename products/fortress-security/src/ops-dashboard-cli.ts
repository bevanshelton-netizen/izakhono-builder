import { buildDashboard } from './ops-dashboard.js';

export function dashboardJson(input: Parameters<typeof buildDashboard>[0]): string {
  return JSON.stringify(buildDashboard(input), null, 2);
}

if (process.argv[1]?.endsWith('ops-dashboard-cli.ts')) {
  console.error('FORTRESS dashboard CLI requires an application data adapter; use dashboardJson() from the control plane.');
}
