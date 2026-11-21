import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { createJarvisPostgresAdapter } from "./db.mjs";
import { jarvisWorkforceRoute } from "../src/workforce.ts";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;
const OWNER_SECRET = process.env.JARVIS_OWNER_SECRET;
const WORKER_TOKEN = process.env.JARVIS_WORKER_TOKEN;

function required(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " is required");
  return value.trim();
}
function equalSecret(actual, expected) {
  if (typeof actual !== "string" || !expected) return false;
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    },
  });
}

required(DATABASE_URL, "DATABASE_URL");
required(OWNER_SECRET, "JARVIS_OWNER_SECRET");
required(WORKER_TOKEN, "JARVIS_WORKER_TOKEN");
if (Buffer.byteLength(OWNER_SECRET) < 32) throw new Error("JARVIS_OWNER_SECRET must contain at least 32 bytes");
if (Buffer.byteLength(WORKER_TOKEN) < 32) throw new Error("JARVIS_WORKER_TOKEN must contain at least 32 bytes");

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
  application_name: "izakhono-jarvis-api",
  ssl: process.env.DATABASE_SSLMODE === "disable"
    ? false
    : { rejectUnauthorized: true },
});
const env = { DB: createJarvisPostgresAdapter(pool) };

async function handle(request) {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/health/live") {
    return responseJson({ ok: true, service: "izakhono-jarvis-api", state: "live" });
  }
  if (request.method === "GET" && path === "/health/ready") {
    try {
      await pool.query("SELECT 1");
      const schema = await pool.query("SELECT to_regclass('public.jarvis_orchestration_steps') AS workforce_table");
      if (!schema.rows?.[0]?.workforce_table) {
        return responseJson({ ok: false, state: "not-ready", reason: "J.A.R.V.I.S. PostgreSQL schema is not installed" }, 503);
      }
      return responseJson({ ok: true, service: "izakhono-jarvis-api", database: "available", schema: "available" });
    } catch {
      return responseJson({ ok: false, state: "not-ready", reason: "Database readiness check failed" }, 503);
    }
  }

  const ownerAuthorized = async () => equalSecret(request.headers.get("x-admin-secret"), OWNER_SECRET);
  const workerAuthorized = async () => equalSecret(
    request.headers.get("authorization")?.replace(/^Bearer\\s+/i, ""),
    WORKER_TOKEN,
  );
  try {
    const workforce = await jarvisWorkforceRoute(request, env, ownerAuthorized, workerAuthorized);
    if (workforce) return workforce;
    return responseJson({ ok: false, error: "Not found" }, 404);
  } catch {
    return responseJson({ ok: false, error: "Internal service error" }, 500);
  }
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method || "GET";
    const url = new URL(incoming.url || "/", "http://jarvis.internal");
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(", "));
    }
    const init = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      const chunks = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > 65536) {
          outgoing.writeHead(413, { "content-type": "application/json", "cache-control": "no-store" });
          outgoing.end(JSON.stringify({ ok: false, error: "Request body too large" }));
          return;
        }
        chunks.push(chunk);
      }
      init.body = Buffer.concat(chunks);
    }
    const request = new Request(url, init);
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    if (!outgoing.headersSent) outgoing.writeHead(400, { "content-type": "application/json", "cache-control": "no-store" });
    outgoing.end(JSON.stringify({ ok: false, error: "Invalid request" }));
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(JSON.stringify({ event: "jarvis.api.started", host: HOST, port: PORT }) + "\n");
});

async function shutdown(signal) {
  process.stdout.write(JSON.stringify({ event: "jarvis.api.shutdown", signal }) + "\n");
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
