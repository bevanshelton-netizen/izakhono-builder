const base = process.env.CONNECTA_ENGINE_URL || 'http://127.0.0.1:4100';
const email = process.env.CONNECTA_TEST_EMAIL;
const password = process.env.CONNECTA_TEST_PASSWORD;
const handle = process.env.CONNECTA_TEST_HANDLE || `discovery-smoke-${Date.now()}`;
const displayName = process.env.CONNECTA_TEST_NAME || 'CONNECTA Discovery Smoke';

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

if (!email || !password) {
  console.error('CONNECTA_TEST_EMAIL and CONNECTA_TEST_PASSWORD are required.');
  process.exit(2);
}

const registration = await request('/register', { method: 'POST', body: JSON.stringify({ email, password, handle, displayName }) });
if (![201, 409].includes(registration.response.status)) throw new Error(`registration failed: ${registration.response.status}`);

const login = await request('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
if (!login.response.ok) throw new Error(`login failed: ${login.response.status}`);
const token = login.body.token;
if (!token) throw new Error('login did not return a token');

const discovery = await request('/v1/discovery?kind=vehicle&limit=10');
if (!discovery.response.ok || discovery.body.trust !== 'ACTIVE_ONLY') throw new Error('public discovery trust contract failed');

const record = discovery.body.records?.find((item) => item.trust_status === 'ACTIVE');
if (!record) {
  console.log('PASS: discovery endpoint is healthy, but no ACTIVE vehicle record exists; no enquiry was attempted.');
  process.exit(0);
}

const enquiry = await request(`/v1/discovery/${record.id}/enquiries`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
  body: JSON.stringify({ message: 'Discovery smoke test enquiry', consentToContact: false, campaignId: 'smoke-test' }),
});

if (enquiry.response.status !== 201) throw new Error(`enquiry failed: ${enquiry.response.status}`);
if (enquiry.body.commercialState !== 'ENQUIRY_NOT_SALE') throw new Error('enquiry incorrectly represented as sale');
if (!enquiry.body.enquiry?.attribution_id) throw new Error('attribution ID missing');

console.log('PASS: verified discovery → authenticated enquiry → attribution, with ENQUIRY_NOT_SALE state.');
