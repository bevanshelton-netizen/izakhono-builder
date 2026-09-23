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

console.log(JSON.stringify({ok:true}));
