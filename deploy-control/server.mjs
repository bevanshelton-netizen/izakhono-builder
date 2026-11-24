import { createServer } from "node:http";
import { Pool } from "pg";
import { createDeployApiHandler } from "./api.mjs";
import { createFortressAccessTokenVerifier } from "./fortress-verifier.mjs";

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim() || /^(replace-with|changeme|todo|tbd)$/i.test(value.trim())) {
    throw new Error(`Required DEPLOY configuration is missing: ${name}`);
  }
  return value.trim();
}

const databaseUrl = required("IZAKHONO_RUNTIME_DATABASE_URL");
const introspectionUrl = required("FORTRESS_DEPLOY_INTROSPECTION_URL");
const introspectionSecret = required("FORTRESS_DEPLOY_INTROSPECTION_SECRET");
const issuer = process.env.FORTRESS_SESSION_ISSUER || "https://fortress.izakhono.internal";
const audience = process.env.FORTRESS_DEPLOY_AUDIENCE || "izakhono-deploy";
const host = process.env.DEPLOY_API_HOST || "127.0.0.1";
const port = Number(process.env.DEPLOY_API_PORT || 8090);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DEPLOY_API_PORT must be an integer between 1 and 65535.");
}
if (!/^https:\/\//.test(issuer) || !audience.trim()) {
  throw new Error("FORTRESS issuer/audience configuration is invalid.");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 8,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: "izakhono-deploy-control"
});
const verifyAccessToken = createFortressAccessTokenVerifier({
  introspectionUrl,
  introspectionSecret,
  timeoutMs: 5000
});
const handler = createDeployApiHandler({
  pool,
  verifyAccessToken,
  issuer,
  audience
});

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of incoming) {
      totalBytes += chunk.length;
      if (totalBytes > 256 * 1024) {
        outgoing.statusCode = 413;
        outgoing.setHeader("content-type", "application/json; charset=utf-8");
        outgoing.setHeader("cache-control", "no-store");
        outgoing.end('{"error":"REQUEST_TOO_LARGE"}');
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (value !== undefined && !["connection", "transfer-encoding", "upgrade"].includes(name.toLowerCase())) {
        headers.set(name, Array.isArray(value) ? value.join(", ") : value);
      }
    }
    const method = incoming.method || "GET";
    const init = { method, headers };
    if (!["GET", "HEAD"].includes(method) && body.length) init.body = body;
    const request = new Request(new URL(incoming.url || "/", "http://127.0.0.1"), init);
    const response = await handler(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, name) => outgoing.setHeader(name, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json; charset=utf-8");
    outgoing.setHeader("cache-control", "no-store");
    outgoing.end('{"error":"INTERNAL_ERROR"}');
  }
});

async function start() {
  // Read-only startup gates: the authoritative Runtime Fabric tables must
  // already exist, and the separate FORTRESS introspection secret must work.
  await pool.query("SELECT 1");
  const schema = await pool.query(
    "SELECT to_regclass('public.izakhono_runtime_deployments') AS deployments, " +
    "to_regclass('public.fortress_audit_events') AS fortress_audit"
  );
  if (!schema.rows[0]?.deployments || !schema.rows[0]?.fortress_audit) {
    throw new Error("Required Runtime Fabric and FORTRESS audit tables are not provisioned; DEPLOY will not start.");
  }
  await verifyAccessToken("startup.invalid.probe");
  server.listen(port, host, () => {
    process.stdout.write(`IZAKHONO DEPLOY listening on ${host}:${port}\n`);
  });
}

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);

start().catch(async () => {
  await pool.end().catch(() => {});
  process.stderr.write("IZAKHONO DEPLOY startup blocked: configuration, database schema or FORTRESS introspection gate failed.\n");
  process.exit(1);
});
