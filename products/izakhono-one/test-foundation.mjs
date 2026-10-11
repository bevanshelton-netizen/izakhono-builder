import { foundationDescriptor, prepareServiceRequest } from './services/foundation.mjs';

const required = ['search','connecta','ai','cloud','commerce','nav','fortress'];
for (const service of required) {
  const descriptor = foundationDescriptor(service);
  if (!descriptor || descriptor.status !== 'foundation') throw new Error(`${service}: foundation descriptor missing`);
}
const read = prepareServiceRequest({service:'search', capability:'web_search'});
if (read.decision !== 'review') throw new Error(`search/web_search: expected review, got ${read.decision}`);
const unsupported = prepareServiceRequest({service:'search', capability:'payments'});
if (unsupported.decision !== 'deny') throw new Error(`unsupported capability: expected deny, got ${unsupported.decision}`);
const payment = prepareServiceRequest({service:'commerce', capability:'payments', verified:false});
if (payment.decision !== 'review' || payment.reason !== 'payment_verification_required') throw new Error('commerce/payments verification gate failed');
console.log('IZAKHONO ONE foundation test: PASS');
