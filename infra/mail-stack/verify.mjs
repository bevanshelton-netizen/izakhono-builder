import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const file = path.join(here, "platform-identities.json");
const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
const readiness = JSON.parse(fs.readFileSync(path.join(here, "domain-readiness.json"), "utf8"));

const problems = [];
const seenIds = new Set();
const seenPrimary = new Set();
const shared = cfg.shared_domain;

function primary(p) {
  const domain = p.domain || shared;
  if (p.dedicated) return `${p.slug}@${domain}`;
  return `${p.slug}@${domain}`;
}

for (const p of cfg.platforms) {
  if (!p.id || !p.name || !p.slug) problems.push(`missing required field: ${JSON.stringify(p)}`);
  if (seenIds.has(p.id)) problems.push(`duplicate platform id: ${p.id}`);
  seenIds.add(p.id);

  if (!/^[a-z0-9][a-z0-9-]*$/.test(p.slug)) problems.push(`invalid slug: ${p.slug}`);

  const addr = primary(p);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) problems.push(`invalid primary address: ${addr}`);

  if (seenPrimary.has(addr)) problems.push(`duplicate primary address: ${addr}`);
  seenPrimary.add(addr);

  if (p.dedicated && !p.domain) problems.push(`dedicated identity missing domain: ${p.id}`);
}

if (!cfg.platforms.some(p => p.id === "kora")) problems.push("KORA identity missing");
if (!cfg.platforms.some(p => p.id === "izakhono-africa")) problems.push("IZAKHONO AFRICA identity missing");

for (const [domain,state] of Object.entries(readiness.domains || {})) {
  if (!state.status) problems.push(`domain readiness missing status: ${domain}`);
  if (state.sender_enabled === true && state.status !== "LIVE_VERIFIED") problems.push(`sender enabled before LIVE_VERIFIED: ${domain}`);
}

if (problems.length) {
  console.error("IZAKHONO Mail Stack verification FAILED");
  for (const p of problems) console.error("- " + p);
  process.exit(1);
}

console.log(`IZAKHONO Mail Stack verification PASSED: ${cfg.platforms.length} platform identities; ${Object.keys(readiness.domains || {}).length} domains gated`);
