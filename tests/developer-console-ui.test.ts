import { CONSOLE_SCREENS, ONBOARDING_STEPS, consoleWelcome } from '../registry/developer-console-ui';

if (CONSOLE_SCREENS.length < 10) throw new Error('console navigation incomplete');
if (ONBOARDING_STEPS.map(x => x.id).join(',') !== 'account,idea,stack,preview,verify,deploy,monetize') throw new Error('onboarding journey mismatch');
if (consoleWelcome('Test').firstAction !== '/console/new') throw new Error('welcome action mismatch');
console.log('Developer console UI contract passed');
