const controlPlaneUrl = process.env.IZAKHONO_CONTROL_PLANE_URL || '';
const nodeKey = process.env.IZAKHONO_NODE_KEY || '';
const endpoint = process.env.IZAKHONO_PUBLIC_BASE_URL || '';

async function post(path, body) {
  if (!controlPlaneUrl || !nodeKey) throw new Error('CONTROL_PLANE_CONFIG_REQUIRED');
  const response = await fetch(`${controlPlaneUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${nodeKey}` },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `CONTROL_PLANE_${response.status}`);
  return data;
}

export async function registerNode() {
  return post('/v1/hosting/nodes/register', {
    node_key: nodeKey,
    endpoint,
    metadata: { contract: 'izakhono.hosting.node.v1', release_contract: 'izakhono.release.v1' },
  });
}

export async function heartbeat(ready) {
  return post('/v1/hosting/nodes/heartbeat', {
    node_key: nodeKey,
    ready,
    endpoint,
    metadata: { contract: 'izakhono.hosting.node.v1' },
  });
}

export function startHeartbeat(isReady) {
  const run = async () => {
    try { await heartbeat(Boolean(isReady())); } catch (error) { console.error(`[hosting-node] heartbeat failed: ${error.message}`); }
  };
  void run();
  return setInterval(run, Number(process.env.IZAKHONO_HEARTBEAT_MS || 60000));
}
