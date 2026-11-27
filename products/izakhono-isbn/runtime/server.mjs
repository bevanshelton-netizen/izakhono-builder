import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import worker from "../src/index.ts";
import { createPostgresD1Adapter } from "../src/postgresql-adapter.ts";

const { Pool } = pg;
const required = ["DATABASE_URL", "ISBN_ADMIN_TOKEN"];
for (const key of required) if (!process.env[key]) {
  console.error(`Missing required environment variable: ${key}`);
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  application_name: "izakhono-isbn-registry"
});
const DB = createPostgresD1Adapter(pool);
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const mime = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon" };

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || "localhost";
    const url = new URL(incoming.url || "/", `http://${host}`);
    if (!url.pathname.startsWith("/api/") && incoming.method === "GET") {
      const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      const safe = normalize(requested).replace(/^([.][.][/\\\\])+/, "");
      try {
        const path = join(publicDir, safe);
        const body = await readFile(path);
        outgoing.writeHead(200, { "content-type": mime[extname(path)] || "application/octet-stream", "x-content-type-options":"nosniff" });
        outgoing.end(body);
        return;
      } catch { outgoing.writeHead(404); outgoing.end("Not found"); return; }
    }
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method: incoming.method,
      headers: incoming.headers,
      body: ["GET", "HEAD"].includes(incoming.method || "GET") ? undefined : body
    });
    const response = await worker.fetch(request, {
      DB,
      ISBN_ADMIN_TOKEN: process.env.ISBN_ADMIN_TOKEN
    });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error("registry_request_failed", error?.message || "unknown_error");
    if (!outgoing.headersSent) outgoing.writeHead(500, { "content-type":"application/json" });
    outgoing.end(JSON.stringify({ error:"internal_error" }));
  }
});
const port = Number(process.env.PORT || 8080);
server.listen(port, "0.0.0.0", () => console.log(`IZAKHONO ISBN Registry listening on ${port}`));
async function shutdown() {
  server.close(async () => { await pool.end(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
