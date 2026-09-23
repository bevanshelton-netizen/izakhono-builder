const base = process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';
const ownerKey = process.env.CONNECTA_OWNER_KEY;
if (!ownerKey) throw new Error('CONNECTA_OWNER_KEY required');

async function api(path, { method='GET', token, body, owner=false, expect } = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  if (owner) headers['x-connecta-owner-key'] = ownerKey;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (expect !== undefined) {
    if (response.status !== expect) {
      throw new Error(`${method} ${path}: expected ${expect}, got ${response.status}: ${JSON.stringify(data)}`);
    }
  } else if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return { status: response.status, data };
}

const suffix = Date.now().toString(36);

const victim = (await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`protected-${suffix}@connecta.local`,
    handle:`safe.person.${suffix}`,
    displayName:'Protected Person',
    password:'Correct-Horse-Battery-Staple-11',
  },
})).data;

await api(`/v1/admin/identities/${victim.account.id}/protect`, {
  method:'POST',
  owner:true,
});

const cloneAttempt = await api('/v1/auth/register', {
  method:'POST',
  expect:409,
  body:{
    email:`clone-${suffix}@connecta.local`,
    handle:`safe-person-${suffix}`,
    displayName:'Protected Person',
    password:'Correct-Horse-Battery-Staple-12',
  },
});
if (cloneAttempt.data.category !== 'account-cloning') {
  throw new Error('Protected account clone was not classified correctly');
}

const bully = (await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`bully-${suffix}@connecta.local`,
    handle:`bully-${suffix}`,
    displayName:'Safety Test Bully',
    password:'Correct-Horse-Battery-Staple-13',
  },
})).data;

const bullying = await api('/v1/posts', {
  method:'POST',
  token:bully.token,
  expect:423,
  body:{body:'Go kill yourself',visibility:'public'},
});
if (!bullying.data.blocked || bullying.data.enforcement?.action !== 'disabled') {
  throw new Error('Cyberbullying did not disable the account');
}

const blockedLogin = await api('/v1/auth/login', {
  method:'POST',
  expect:423,
  body:{
    email:`bully-${suffix}@connecta.local`,
    password:'Correct-Horse-Battery-Staple-13',
  },
});
if (!String(blockedLogin.data.notice?.title || '').includes('FORMAL')) {
  throw new Error('Formal violation warning was not returned to disabled account');
}

await api('/v1/safety/appeals', {
  method:'POST',
  body:{
    email:`bully-${suffix}@connecta.local`,
    password:'Correct-Horse-Battery-Staple-13',
    caseId:bullying.data.enforcement.caseId,
    statement:'I request an independent review of this safety enforcement.',
  },
});

const reporter = (await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`reporter-${suffix}@connecta.local`,
    handle:`reporter-${suffix}`,
    displayName:'Safety Reporter',
    password:'Correct-Horse-Battery-Staple-14',
  },
})).data;

const reported = (await api('/v1/auth/register', {
  method:'POST',
  body:{
    email:`reported-${suffix}@connecta.local`,
    handle:`reported-${suffix}`,
    displayName:'Reported Account',
    password:'Correct-Horse-Battery-Staple-15',
  },
})).data;

const report = await api('/v1/reports', {
  method:'POST',
  token:reporter.token,
  body:{
    targetType:'account',
    targetId:reported.account.id,
    reason:'cyberbullying',
    detail:'Repeated targeted humiliation and abusive messages.',
  },
});
if (!report.data.protectiveLock || !report.data.caseId) {
  throw new Error('Report did not create immediate safety lock');
}

const lockedLogin = await api('/v1/auth/login', {
  method:'POST',
  expect:423,
  body:{
    email:`reported-${suffix}@connecta.local`,
    password:'Correct-Horse-Battery-Staple-15',
  },
});
if (!String(lockedLogin.data.notice?.title || '').includes('SAFETY LOCK')) {
  throw new Error('Protective-lock notice was not returned');
}

await api(`/v1/admin/moderation/${report.data.caseId}`, {
  method:'PATCH',
  owner:true,
  body:{action:'confirm',note:'Confirmed zero-tolerance cyberbullying violation.'},
});

const confirmedLogin = await api('/v1/auth/login', {
  method:'POST',
  expect:423,
  body:{
    email:`reported-${suffix}@connecta.local`,
    password:'Correct-Horse-Battery-Staple-15',
  },
});
if (!String(confirmedLogin.data.notice?.title || '').includes('FORMAL')) {
  throw new Error('Confirmed violation did not issue formal warning');
}

console.log(JSON.stringify({
  ok:true,
  cyberbullyingDisabled:true,
  reportImmediateLock:true,
  confirmedWarning:true,
  appealAvailable:true,
  cloneRegistrationBlocked:true,
}));
