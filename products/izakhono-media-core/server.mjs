import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildPlayoutWindow, toEpgXml, normalizeEvent, summarizeEvents, createProvisioningJob } from "./engines/index.mjs";

const PORT = Number(process.env.MEDIA_CORE_PORT || 8787);
const HOST = process.env.MEDIA_PUBLIC_HOST || "localhost";
const ADMIN_TOKEN = process.env.MEDIA_ADMIN_TOKEN || "dev-only-change-me";
const DATA_DIR = process.env.MEDIA_DATA_DIR || path.resolve("./data");
const DB = path.join(DATA_DIR, "media-core.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({ channels: [], analytics: [], provisioning: [] }, null, 2));

const readDb = () => {
  const db = JSON.parse(fs.readFileSync(DB, "utf8"));
  db.channels ||= [];
  db.analytics ||= [];
  db.provisioning ||= [];
  return db;
};
const writeDb = (db) => fs.writeFileSync(DB, JSON.stringify(db, null, 2));
const id = (prefix) => `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
const streamKey = () => crypto.randomBytes(24).toString("base64url");
const slug = (value) => String(value || "channel").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "channel";

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function requireAdmin(req, res) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token !== ADMIN_TOKEN) {
    send(res, 401, { error: "admin authentication required" });
    return false;
  }
  return true;
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("invalid JSON"); }
}

function channelView(channel) {
  return {
    ...channel,
    endpoints: {
      rtmp_publish: `rtmp://${HOST}:1935/${channel.slug}`,
      srt_publish: `srt://${HOST}:8890?streamid=publish:${channel.slug}`,
      hls: `http://${HOST}:8888/${channel.slug}/index.m3u8`,
      webrtc: `http://${HOST}:8889/${channel.slug}`
    }
  };
}

const ENGINE_STATUS = ["content", "playout", "epg", "advertising", "monetization", "analytics", "provisioning"];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "izakhono-media-core", version: "0.2.0", time: new Date().toISOString() });
  if (req.method === "GET" && url.pathname === "/api/engines/status") return send(res, 200, { status: "ready", engines: ENGINE_STATUS.map(name => ({ name, mode: "control-plane" })) });
  if (req.method === "GET" && url.pathname === "/api/channels") return send(res, 200, { items: readDb().channels.map(channelView) });
  if (req.method === "GET" && url.pathname === "/api/analytics/summary") return send(res, 200, summarizeEvents(readDb().analytics));

  if (req.method === "POST" && url.pathname === "/api/channels") {
    if (!requireAdmin(req, res)) return;
    try {
      const input = await body(req);
      if (!input.name) return send(res, 400, { error: "name is required" });
      const db = readDb();
      const channel = {
        id: id("ch"), slug: slug(input.slug || input.name), name: String(input.name),
        description: String(input.description || ""), status: "draft", approved: false,
        stream_key: streamKey(), created_at: new Date().toISOString(),
        playlist: [], schedule: [], fallback: input.fallback || null
      };
      if (db.channels.some(x => x.slug === channel.slug)) return send(res, 409, { error: "channel slug already exists" });
      db.channels.push(channel); writeDb(db);
      return send(res, 201, channelView(channel));
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/analytics/events") {
    if (!requireAdmin(req, res)) return;
    try {
      const input = await body(req);
      const events = Array.isArray(input.events) ? input.events : [input];
      const normalized = events.map(normalizeEvent);
      const db = readDb();
      db.analytics.push(...normalized);
      db.analytics = db.analytics.slice(-10000);
      writeDb(db);
      return send(res, 202, { accepted: normalized.length });
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  if (req.method === "POST" && url.pathname === "/api/provisioning/jobs") {
    if (!requireAdmin(req, res)) return;
    try {
      const input = await body(req);
      const job = createProvisioningJob(input.order);
      const db = readDb();
      db.provisioning.push(job);
      writeDb(db);
      return send(res, 201, job);
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  const channelId = parts[1];
  const channel = channelId ? readDb().channels.find(x => x.id === channelId) : null;
  if (parts[0] === "api" && parts[1] === "channels" && !channel) return send(res, 404, { error: "channel not found" });

  if (channel && req.method === "GET" && parts.length === 3 && parts[2] === "epg.xml") {
    try { return send(res, 200, toEpgXml({ channelId: channel.id, channelName: channel.name, schedule: channel.schedule }), "application/xml"); }
    catch (e) { return send(res, 422, { error: e.message }); }
  }
  if (channel && req.method === "GET" && parts.length === 3 && parts[2] === "stream-config") return send(res, 200, channelView(channel));
  if (channel && req.method === "GET" && parts.length === 2) return send(res, 200, channelView(channel));

  if (channel && req.method === "GET" && parts.length === 4 && parts[2] === "playout" && parts[3] === "next") {
    const cursor = Number(url.searchParams.get("cursor") || 0);
    return send(res, 200, buildPlayoutWindow({ playlist: channel.playlist, fallback: channel.fallback, startAt: url.searchParams.get("startAt") || undefined, maxItems: Math.min(Number(url.searchParams.get("limit") || 1), 20) }).map((item, index) => ({ ...item, cursor: cursor + index + 1 })));
  }

  if (channel && req.method === "POST" && parts.length === 3) {
    if (!requireAdmin(req, res)) return;
    try {
      const input = await body(req);
      const db = readDb();
      const current = db.channels.find(x => x.id === channel.id);
      if (parts[2] === "playlist") {
        if (!Array.isArray(input.items)) return send(res, 400, { error: "items must be an array" });
        current.playlist = input.items.map(item => ({ id: item.id || id("asset"), title: String(item.title || "Untitled"), uri: String(item.uri || ""), duration_seconds: Number(item.duration_seconds || 0), type: String(item.type || "vod") }));
      } else if (parts[2] === "schedule") {
        if (!Array.isArray(input.items)) return send(res, 400, { error: "items must be an array" });
        current.schedule = input.items.map(item => ({ title: String(item.title || "Untitled"), start: String(item.start), end: String(item.end), description: String(item.description || "") }));
      } else if (parts[2] === "approve") {
        current.approved = true; current.status = "approved"; current.approved_at = new Date().toISOString(); current.approved_by = String(input.reviewer || "human");
      } else return send(res, 404, { error: "unknown channel operation" });
      writeDb(db); return send(res, 200, channelView(current));
    } catch (e) { return send(res, 400, { error: e.message }); }
  }

  send(res, 404, { error: "not found" });
});

server.listen(PORT, () => console.log(`IZAKHONO MEDIA CORE listening on :${PORT}`));
