import { buildConsoleSummary, validateConsoleAction } from '../src/developer-console-api';

const summary = buildConsoleSummary({
  developerId: 'dev_1',
  appIds: ['app_1'],
  services: ['identity', 'cloud', 'commerce'],
});

if (summary.apps !== 1) throw new Error('app summary failed');
if (!summary.nextActions.includes('verify-app')) throw new Error('trust action missing');
if (!summary.nextActions.includes('publish-and-grow')) throw new Error('growth action missing');
if (validateConsoleAction({ action: 'deploy', developerId: 'dev_1' }).length !== 1) {
  throw new Error('deploy validation failed');
}
if (validateConsoleAction({ action: 'deploy', developerId: 'dev_1', appId: 'app_1' }).length !== 0) {
  throw new Error('valid deploy rejected');
}
console.log('Developer console API tests passed');
