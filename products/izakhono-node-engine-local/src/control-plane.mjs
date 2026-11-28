import http from "node:http";
import os from "node:os";

function reply(res, status, payload, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'", "referrer-policy": "no-referrer" });
  res.end(type.startsWith("application/json") ? JSON.stringify(payload) : payload);
}
const DASHBOARD = [
"<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>IZAKHONO NODE ENGINE</title>",
"<style>body{font:16px system-ui,sans-serif;max-width:850px;margin:40px auto;padding:0 18px;background:#101820;color:#eef4f7}h1{font-size:1.7rem}.muted{color:#a9bbc5}.panel{background:#1c2a34;border:1px solid #344854;border-radius:12px;padding:18px;margin:14px 0}.state{font-size:1.3rem;font-weight:700}button{padding:12px 20px;border:0;border-radius:8px;margin:6px 8px 6px 0;font-weight:700;cursor:pointer}button:disabled{opacity:.45}pre{white-space:pre-wrap;overflow-wrap:anywhere;color:#c5d5dd}.running{color:#8ee0ad}.stopped{color:#ffc27d}</style></head>",
"<body><h1>IZAKHONO NODE ENGINE</h1><p class=\"muted\">Single-device self-hosting · Local owner control</p><section class=\"panel\"><div>Website host</div><div id=\"state\" class=\"state\">Loading…</div><p id=\"site\" class=\"muted\">—</p><button id=\"start\">Start hosting</button><button id=\"stop\">Stop hosting</button><p id=\"message\" class=\"muted\" role=\"status\">Control panel is available only on this device.</p></section>",
"<section class=\"panel\"><h2>Device snapshot</h2><pre id=\"metrics\">Loading…</pre><p class=\"muted\">System snapshot and controller-process memory only. These are not per-workload measurements or enforced resource limits.</p></section>",
"<script>const $=id=>document.getElementById(id);let busy=false;async function act(action){if(busy)return;busy=true;$('start').disabled=$('stop').disabled=true;$('message').textContent='Applying owner command…';try{const r=await fetch('/api/'+action,{method:'POST'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');$('message').textContent='Command completed.';await refresh()}catch(e){$('message').textContent=e.message}finally{busy=false;$('start').disabled=$('stop').disabled=false}}async function refresh(){try{const r=await fetch('/api/status');const d=await r.json();const e=d.engine;$('state').textContent=e.state.toUpperCase();$('state').className='state '+e.state;$('site').textContent=e.url||'Website host is stopped';$('metrics').textContent=JSON.stringify({system:d.system,controllerProcess:d.controllerProcess},null,2);$('start').disabled=busy||e.state==='running';$('stop').disabled=busy||e.state!=='running'}catch{$('message').textContent='Cannot reach the local controller.'}}$('start').addEventListener('click',()=>act('start'));$('stop').addEventListener('click',()=>act('stop'));refresh();setInterval(refresh,5000);</script></body></html>"
].join("\n");

export function createControlPlane({ engine, host = "127.0.0.1", port = 4322 } = {}) {
  if (!engine) throw new TypeError("engine is required");
  if (host !== "127.0.0.1") throw new Error("Control plane must bind to 127.0.0.1");
  let server;
  let actualPort = port;
  const allowedHosts = () => new Set(["127.0.0.1:" + actualPort, "localhost:" + actualPort]);
  const allowedOrigins = () => new Set(["http://127.0.0.1:" + actualPort, "http://localhost:" + actualPort]);
  async function handle(req, res) {
    if (!allowedHosts().has(req.headers.host)) return reply(res, 403, { error: "Invalid host" });
    const url = new URL(req.url, "http://127.0.0.1:" + actualPort);
    if (req.method === "GET" && url.pathname === "/") return reply(res, 200, DASHBOARD, "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/api/status") {
      const memory = process.memoryUsage();
      return reply(res, 200, {
        engine: engine.status(),
        system: { platform: process.platform, architecture: process.arch, cpuCount: os.cpus().length, totalMemoryMb: Math.round(os.totalmem() / 1048576), freeMemoryMb: Math.round(os.freemem() / 1048576), loadAverage: os.loadavg() },
        controllerProcess: { uptimeSeconds: Math.floor(process.uptime()), rssMb: Math.round(memory.rss / 1048576), heapUsedMb: Math.round(memory.heapUsed / 1048576) },
        measurements: "controller-process-and-system-snapshot; not per-workload quotas"
      });
    }
    if (req.method === "POST" && ["/api/start", "/api/stop"].includes(url.pathname)) {
      if (!allowedOrigins().has(req.headers.origin)) return reply(res, 403, { error: "A same-origin browser request is required" });
      try {
        const status = url.pathname === "/api/start" ? await engine.start() : await engine.stop();
        return reply(res, 200, { engine: status });
      } catch { return reply(res, 500, { error: "Engine operation failed" }); }
    }
    return reply(res, 404, { error: "Not found" });
  }
  return {
    async start() {
      if (server) return this.status();
      server = http.createServer((req, res) => { void handle(req, res); });
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.removeListener("error", reject);
          const address = server.address();
          actualPort = typeof address === "object" ? address.port : port;
          resolve();
        });
      });
      return this.status();
    },
    async stop() {
      if (!server) return this.status();
      const current = server;
      await new Promise((resolve, reject) => current.close(error => error ? reject(error) : resolve()));
      server = undefined;
      return this.status();
    },
    status() { return { state: server ? "running" : "stopped", host, port: actualPort, url: server ? "http://" + host + ":" + actualPort + "/" : null, exposure: "loopback" }; }
  };
}
