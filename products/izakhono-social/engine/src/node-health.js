import { createHmac } from 'node:crypto';

const ALLOWED_NODES = new Set(['NODE01', 'NODE02', 'NODE03', 'NODE04']);
const CLUSTER_ID = 'izakhono-production';
const HEX_256 = /^[a-f0-9]{64}$/i;

export function createNodeHealthChallenge({ nodeId, clusterId, token, nonce }) {
  if (!ALLOWED_NODES.has(String(nodeId))) return null;
  if (clusterId !== CLUSTER_ID) return null;
  if (typeof token !== 'string' || !HEX_256.test(token)) return null;
  if (typeof nonce !== 'string' || !HEX_256.test(nonce)) return null;

  const normalizedNonce = nonce.toLowerCase();
  const signature = createHmac('sha256', Buffer.from(token, 'hex'))
    .update(`${clusterId}\n${nodeId}\n${normalizedNonce}`, 'utf8')
    .digest('hex');

  return {
    ok: true,
    cluster: clusterId,
    runtimeNode: nodeId,
    authScheme: 'bearer-hmac-sha256',
    probeNonce: normalizedNonce,
    probeSignature: signature,
  };
}
