#!/usr/bin/env node
const http = require("http");
const https = require("https");
const { execFile } = require("child_process");

const CONTROL = process.env.IZ_CONTROL_URL || "http://127.0.0.1:8080";
const NODE_NAME = process.env.IZ_NODE_NAME || require("os").hostname();
const REGION = process.env.IZ_NODE_REGION || "unknown";
const ENROLL_TOKEN = process.env.IZ_NODE_ENROLL_TOKEN || "";
const INTERVAL = Number(process.env.IZ_AGENT_INTERVAL_MS || 5000);

if (!ENROLL_TOKEN) {
  console.error("IZ_NODE_ENROLL_TOKEN is required");
  process.exit(1);
}

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(pathname, CONTROL);
    const lib = target.protocol === "https:" ? https : http;
    const data = body ? JSON.stringify(body) : "";
    const req = lib.request(target, {
      method,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(data),
        "x-iz-node-token": ENROLL_TOKEN
      }
    }, res => {
      let out = "";
      res.on("data", c => out += c);
      res.on("end", () => {
        try {
          const parsed = out ? JSON.parse(out) : {};
          if (res.statusCode >= 400) return reject(new Error(parsed.error || "control_plane_error"));
          resolve(parsed);
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function docker(args) {
  return new Promise((resolve, reject) => {
    execFile("docker", args, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

async function metrics() {
  const os = require("os");
  const total = os.totalmem();
  const free = os.freemem();
  const cpus = os.cpus();
  const load = os.loadavg()[0];
  const cpu = Math.max(0, Math.min(100, Math.round((load / Math.max(1, cpus.length)) * 100)));
  const memory = Math.round(((total - free) / total) * 100);
  let workloads = 0;
  try {
    const ids = await docker(["ps","-q"]);
    workloads = ids ? ids.split(/\r?\n/).filter(Boolean).length : 0;
  } catch {}
  return { cpu, memory, workloads };
}

async function execute(workload) {
  const containerName = "iz-" + workload.id.slice(0, 12);
  await docker(["pull", workload.image]);
  const args = ["run","-d","--restart","unless-stopped","--name",containerName];
  if (workload.port) args.push("-p", `${workload.port}:${workload.port}`);
  args.push(workload.image);
  const containerId = await docker(args);
  return { containerId, containerName };
}

async function tick() {
  try {
    const m = await metrics();
    await request("POST", "/api/engine/nodes/heartbeat", { name: NODE_NAME, region: REGION, ...m });
    const next = await request("GET", `/api/engine/workloads/next?node=${encodeURIComponent(NODE_NAME)}`);
    if (next.workload) {
      try {
        const result = await execute(next.workload);
        await request("POST", `/api/engine/workloads/${next.workload.id}/status`, { status:"running", ...result });
      } catch (e) {
        await request("POST", `/api/engine/workloads/${next.workload.id}/status`, { status:"failed", error:e.message });
      }
    }
  } catch (e) {
    console.error(new Date().toISOString(), e.message);
  }
}

(async()=>{
  await request("POST", "/api/engine/nodes/register", { name:NODE_NAME, region:REGION });
  console.log(`IZAKHONO Engine agent registered as ${NODE_NAME} -> ${CONTROL}`);
  await tick();
  setInterval(tick, INTERVAL);
})();
