const base = process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';
const ownerKey = process.env.CONNECTA_OWNER_KEY;
if (!ownerKey) throw new Error('owner key required');

async function call(path, options={}) {
  const headers = {'content-type':'application/json'};
  if (options.token) headers.authorization = 'Bearer ' + options.token;
  if (options.owner) headers['x-connecta-owner-key'] = ownerKey;
  const response = await fetch(base + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  return {response,data};
}

const suffix = Date.now().toString(36);
const passphrase = ['Connecta','Test','Business','31'].join('-');

const accountResult = await call('/v1/auth/register', {
  method:'POST',
  body:{
    email:`biz-${suffix}@connecta.local`,
    handle:`biz-${suffix}`,
    displayName:'Business Owner',
    password:passphrase,
  },
});
if (!accountResult.response.ok) throw new Error('business owner registration failed');
const account = accountResult.data;

const applicationResult = await call('/v1/businesses/apply', {
  method:'POST',
  token:account.token,
  body:{
    legalName:'CONNECTA CI Trading',
    tradingName:'CONNECTA CI Trading',
    registrationNumber:`CI-${suffix}`,
    countryCode:'ZA',
  },
});
if (!applicationResult.response.ok) throw new Error('business application failed');
const businessId = applicationResult.data.business.id;

const earlyVerify = await call(`/v1/admin/businesses/${businessId}/verification`, {
  method:'PATCH',
  owner:true,
  body:{action:'verified',note:'evidence gate test'},
});
if (earlyVerify.response.status !== 400) throw new Error('verification evidence gate did not block');

const evidenceA = await call(`/v1/businesses/${businessId}/evidence`, {
  method:'POST',
  token:account.token,
  body:{evidenceType:'owner_identity',reference:`ci://owner/${suffix}`},
});
const evidenceB = await call(`/v1/businesses/${businessId}/evidence`, {
  method:'POST',
  token:account.token,
  body:{evidenceType:'registration_record',reference:`ci://registration/${suffix}`},
});
if (!evidenceA.response.ok || !evidenceB.response.ok) throw new Error('business evidence submission failed');

for (const item of [evidenceA.data.evidence,evidenceB.data.evidence]) {
  const decision = await call(`/v1/admin/businesses/${businessId}/evidence/${item.id}`, {
    method:'PATCH',
    owner:true,
    body:{action:'accepted',note:'CI evidence accepted'},
  });
  if (!decision.response.ok) throw new Error('business evidence review failed');
}

const finalVerify = await call(`/v1/admin/businesses/${businessId}/verification`, {
  method:'PATCH',
  owner:true,
  body:{action:'verified',note:'evidence-backed verification'},
});
if (!finalVerify.response.ok || finalVerify.data.business.verification_state !== 'verified') {
  throw new Error('evidence-backed business verification failed');
}

const publicResult = await call(`/v1/businesses/${businessId}`);
if (!publicResult.response.ok || publicResult.data.business.verification_state !== 'verified') {
  throw new Error('verified business public view failed');
}

console.log(JSON.stringify({ok:true,businessId,gate:true,verified:true}));
