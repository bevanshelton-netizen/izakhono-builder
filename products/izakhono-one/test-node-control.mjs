import { createNodeStore, registerNode, heartbeatNode, authorizeWorkload, recordDeployment, drainNode, listReadyNodes } from './services/node-control.mjs';

const owner = { id:'owner-1', role:'owner', authenticated:true, verified:true };
const member = { id:'member-1', role:'member', authenticated:true, verified:true };
const store = createNodeStore();

let result = registerNode(store, { principal:owner, node:{ node_id:'node-a', environment:'production', capabilities:['container','http'], runtime_version:'node24', security_posture:'ready' } });
if (!result.ok || result.node.state !== 'registered') throw new Error('node registration failed');

result = heartbeatNode(store, { node_id:'node-a', health:'healthy', revision:'rev-1' });
if (!result.ok || result.node.state !== 'ready') throw new Error('healthy node did not become ready');

result = authorizeWorkload(store, { principal:member, node_id:'node-a', revision:'rev-2' });
if (result.ok || result.reason !== 'fortress_deny') throw new Error('member bypassed node execution gate');

result = authorizeWorkload(store, { principal:owner, node_id:'node-a', revision:'rev-2' });
if (!result.ok || result.node.desired_workload.revision !== 'rev-2') throw new Error('owner workload authorization failed');

result = recordDeployment(store, { node_id:'node-a', revision:'rev-1' });
if (result.ok || result.reason !== 'revision_not_authorized') throw new Error('unauthorized revision deployed');

result = recordDeployment(store, { node_id:'node-a', revision:'rev-2' });
if (!result.ok || !result.deployment_verified) throw new Error('authorized deployment was not verified');

if (listReadyNodes(store).length !== 1) throw new Error('ready node inventory failed');

result = drainNode(store, { principal:owner, node_id:'node-a' });
if (!result.ok || result.node.state !== 'draining') throw new Error('node drain failed');
if (listReadyNodes(store).length !== 0) throw new Error('draining node remained deployable');

const unhealthyStore = createNodeStore([{ node_id:'node-b', state:'registered', health:'degraded', security_posture:'ready' }]);
result = authorizeWorkload(unhealthyStore, { principal:owner, node_id:'node-b', revision:'rev-3' });
if (result.ok || result.reason !== 'node_not_healthy') throw new Error('unhealthy node accepted workload');

const insecureStore = createNodeStore([{ node_id:'node-c', state:'registered', health:'healthy', security_posture:'unknown' }]);
result = authorizeWorkload(insecureStore, { principal:owner, node_id:'node-c', revision:'rev-4' });
if (result.ok || result.reason !== 'node_security_posture_not_ready') throw new Error('insecure node accepted workload');

console.log('IZAKHONO ONE node control test: PASS');
