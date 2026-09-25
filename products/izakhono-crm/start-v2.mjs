import { promises as fs } from "node:fs";
import path from "node:path";

const configured = process.env.CRM_STAFF_FILE || "";
const inline = process.env.CRM_STAFF_JSON || "";
if (inline) {
  JSON.parse(inline);
  const target = configured || "/data/staff.json";
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, inline, { mode: 0o600 });
  process.env.CRM_STAFF_FILE = target;
} else if (!configured) {
  try {
    await fs.access("/data/staff.json");
    process.env.CRM_STAFF_FILE = "/data/staff.json";
  } catch {}
}
await import("./server-v2.mjs");
