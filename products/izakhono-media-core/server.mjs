import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.MEDIA_CORE_PORT || 8787);
const HOST = process.env.MEDIA_PUBLIC_HOST || "localhost";
const ADMIN_TOKEN = process.env.MEDIA_ADMIN_TOKEN || "dev-only-change-me";
const DATA_DIR = process.env.MEDIA_DATA_DIR || path.resolve("./data");
const DB = path.join(DATA_DIR, "media-core.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify({ channels: [] }, null, 2));

const readDb = () => JSON.parse(fs.readFileSync(DB, "utf8"));
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

function epg(channel) {
  const programmes = channel.schedule || [];
  const items = programmes.map((p) => `<programme start="${escapeXml(p.start)}" stop="${escapeXml(p.end)}" channel="${escapeXml(channel.id)}"><title>${escapeXml(p.title)}</title><desc>${escapeXml(p.description || "")}</desc></programme>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><tv generator-info-name="IZAKHONO MEDIA CORE"><channel id="${escapeXml(channel.id)}"><display-name>${escapeXml(channel.name)}</display-name></channel>${items}</tv>`;
}

function escapeXml(v) { return String(v ?? "").replace(/[<>&'\"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" }[c])); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, service: "izakhono-media-core", time: new Date().toISOString() });
  if (req.method === "GET" && url.pathname === "/api/channels") return send(res, 200, { items: readDb().channels.map(channelView) });

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

  const channelId = parts[1];
  const channel = channelId ? readDb().channels.find(x => x.id === channelId) : null;
  if (parts[0] === "api" && parts[1] === "channels" && !channel) return send(res, 404, { error: "channel not found" });

  if (channel && req.method === "GET" && parts.length === 3 && parts[2] === "epg.xml") return send(res, 200, epg(channel), "application/xml");
  if (channel && req.method === "GET" && parts.length === 3 && parts[2] === "stream-config") return send(res, 200, channelView(channel));
  if (channel && req.method === "GET" && parts.length === 2) return send(res, 200, channelView(channel));

  if (channel && req.method === "POST" && parts.length === 3) {
    if (!requireAdmin(req, res)) return;
    try {
      const input = await body(req);
      const db = readDb();
      const current = db.channels.find(x => x.id === channel.id);
      if (parts[2] === "playlist") {
        if (!Array.isArray(input.items)) return send(res, 400, { error: "items must be an array" });
        current.playlist = input.items.map(item => ({ id: item.id || id("asset"), title: String(item.title || "Untitled"), uri: String(item.uri || ""), duration_seconds: Number(item.duration_seconds || 0) }));
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
