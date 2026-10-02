import { appFactoryPlan, appFactorySlug } from '../src/app-factory-flow';

if (appFactorySlug('My Great App!') !== 'my-great-app') throw new Error('slug generation failed');
const plan = appFactoryPlan('Store', 'Sell products', ['commerce', 'ai']);
if (!plan.modules.includes('payments') || !plan.modules.includes('ai')) throw new Error('capability mapping failed');
if (plan.public_live !== false) throw new Error('public-live gate failed');
console.log('App factory flow contract passed');
