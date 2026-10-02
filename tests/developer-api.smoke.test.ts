import { ecosystemValueScore } from '../registry/ecosystem-gravity';

const services = ['identity', 'cloud', 'commerce'];
if (ecosystemValueScore(services as never[]) !== 24) throw new Error('ecosystem score mismatch');
console.log('Developer API contract smoke test passed');
