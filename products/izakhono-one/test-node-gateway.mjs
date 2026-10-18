import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./node-gateway.mjs', import.meta.url), 'utf8');
for (const marker of [
  "createNodeControlApi",
  "IZAKHONO_CONTROL_TOKEN",
  "IZAKHONO_NODE_TOKENS_JSON",
  "SUPABASE_SERVICE_ROLE_KEY",
  "HOST || '0.0.0.0'",
  "'/api/nodes'",
  "'heartbeat'",
  "'workload'",
  "'deploy'",
  "'drain'"
]) {
  if (!source.includes(marker)) throw new Error(`missing_gateway_marker:${marker}`);
}
console.log('node-gateway-contract: ok');
