import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8191);
const ADMIN_TOKEN = process.env.SUPER_CLOUD_ADMIN_TOKEN || '';
const jobs = new Map();

function json(res, status, body) {
  res.writeHead(status, {'content-type':'application/json'});
  res.end(JSON.stringify(body));
}
function auth(req) {
  return !ADMIN_TOKEN || req.headers.authorization === `Bearer ${ADMIN_TOKEN}`;
}
function id() { return crypto.randomUUID(); }
async function body(req) {
  let raw=''; for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}
function plan(input) {
  return {
    id: id(),
    type: 'deployment',
    state: 'planned',
    workloadId: input.workloadId || null,
    image: input.image || null,
    targetRegion: input.targetRegion || 'za-jhb-01',
    desiredReplicas: Number(input.desiredReplicas || 1),
    policy: { ownedFirst: true, productionEvidenceRequired: true },
    steps: [
      'validate-workload', 'select-owned-capacity', 'prepare-image',
      'place-workload', 'health-check', 'record-evidence', 'promote'
    ],
    createdAt: new Date().toISOString()
  };
}
const server = http.createServer(async (req,res) => {
  if (req.url === '/health' && req.method === 'GET') return json(res,200,{ok:true,engine:'deployment-engine'});
  if (!auth(req)) return json(res,401,{error:'unauthorized'});
  try {
    if (req.url === '/v1/status' && req.method === 'GET')
      return json(res,200,{engine:'deployment-engine',jobs:jobs.size});
    if (req.url === '/v1/deployments' && req.method === 'POST') {
      const input = await body(req); const job = plan(input); jobs.set(job.id,job);
      return json(res,202,job);
    }
    const m = req.url.match(/^\/v1\/deployments\/([^/]+)\/(promote|rollback)$/);
    if (m && req.method === 'POST') {
      const job = jobs.get(m[1]); if (!job) return json(res,404,{error:'deployment_not_found'});
      if (m[2] === 'promote') {
        const input = await body(req);
        if (!input.endpointHealth || !input.rollbackRecorded) {
          return json(res,409,{error:'production_evidence_required',required:['endpointHealth','rollbackRecorded']});
        }
        job.state='succeeded'; job.productionEvidence={endpointHealth:true,rollbackRecorded:true,verifiedAt:new Date().toISOString()};
      } else { job.state='rolled_back'; job.rollbackAt=new Date().toISOString(); }
      return json(res,200,job);
    }
    return json(res,404,{error:'not_found'});
  } catch (e) { return json(res,400,{error:'bad_request',message:e.message}); }
});
server.listen(PORT,()=>console.log(`deployment-engine listening on ${PORT}`));
