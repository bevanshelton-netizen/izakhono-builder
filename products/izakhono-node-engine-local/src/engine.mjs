import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
  [".pdf", "application/pdf"]
]);

function isLoopback(host) {
  return host === "localhost" || host === "::1" || host.startsWith("127.");
}

function send(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "content-type": type,
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "cache-control": "no-store"
  });
  res.end(body);
}

export function createNodeEngine({ siteRoot, host = "127.0.0.1", port = 4321, exposeLan = false } = {}) {
  if (!siteRoot) throw new TypeError("siteRoot is required");
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new RangeError("port must be 0..65535");
  if (!isLoopback(host) && exposeLan !== true) {
    throw new Error("Non-loopback binding requires explicit exposeLan: true");
  }

  const root = path.resolve(siteRoot);
  let server;
  let state = "stopped";

  async function handle(req, res) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      return send(res, 405, "Method not allowed");
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return send(res, 400, "Invalid URL path");
    }
    if (pathname.includes("\\") || pathname.includes("\0")) return send(res, 400, "Invalid path");
    const segments = pathname.split("/");
    if (segments.some(segment => segment === "..")) return send(res, 403, "Forbidden");

    const relative = pathname.replace(/^\/+/, "") || "index.html";
    let candidate = path.resolve(root, relative);
    const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (candidate !== root && !candidate.startsWith(rootPrefix)) return send(res, 403, "Forbidden");

    try {
      const realRoot = await fs.realpath(root);
      let realCandidate = await fs.realpath(candidate);
      const realPrefix = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
      if (realCandidate !== realRoot && !realCandidate.startsWith(realPrefix)) {
        return send(res, 403, "Forbidden");
      }
      let info = await fs.stat(realCandidate);
      if (info.isDirectory()) {
        candidate = path.join(realCandidate, "index.html");
        realCandidate = await fs.realpath(candidate);
        if (realCandidate !== realRoot && !realCandidate.startsWith(realPrefix)) {
          return send(res, 403, "Forbidden");
        }
        info = await fs.stat(realCandidate);
      }
      if (!info.isFile()) return send(res, 404, "Not found");
      const contentType = MIME.get(path.extname(realCandidate).toLowerCase()) ?? "application/octet-stream";
      res.writeHead(200, {
        "content-type": contentType,
        "content-length": info.size,
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store"
      });
      if (req.method === "HEAD") return res.end();
      const stream = (await import("node:fs")).createReadStream(realCandidate);
      stream.on("error", () => {
        if (!res.headersSent) send(res, 500, "Read error");
        else res.destroy();
      });
      stream.pipe(res);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return send(res, 404, "Not found");
      return send(res, 500, "Host error");
    }
  }

  return {
    async start() {
      if (state === "running") return this.status();
      await fs.access(root);
      server = http.createServer((req, res) => { void handle(req, res); });
      state = "starting";
      try {
        await new Promise((resolve, reject) => {
          server.once("error", reject);
          server.listen(port, host, () => {
            server.removeListener("error", reject);
            resolve();
          });
        });
        state = "running";
        return this.status();
      } catch (error) {
        state = "stopped";
        server = undefined;
        throw error;
      }
    },
    async stop() {
      if (!server) {
        state = "stopped";
        return this.status();
      }
      const current = server;
      state = "stopping";
      await new Promise((resolve, reject) => current.close(error => error ? reject(error) : resolve()));
      server = undefined;
      state = "stopped";
      return this.status();
    },
    status() {
      const address = server?.address();
      const actualHost = address && typeof address === "object" ? address.address : host;
      const actualPort = address && typeof address === "object" ? address.port : port;
      return {
        state,
        host: actualHost,
        port: actualPort,
        url: state === "running" ? `http://${actualHost.includes(":") ? "[" + actualHost + "]" : actualHost}:${actualPort}/` : null,
        exposure: isLoopback(host) ? "loopback" : "lan"
      };
    }
  };
}
