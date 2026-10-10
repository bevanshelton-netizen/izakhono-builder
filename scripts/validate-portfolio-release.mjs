import fs from "node:fs";

const manifestPath = "portfolio/PORTFOLIO-RELEASE-MANIFEST.v1.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.schema !== "izakhono.portfolio-release/v1") throw new Error("Invalid portfolio manifest schema");
if (manifest.policy !== "owned-first-externally-reversible") throw new Error("Owned-first policy missing");
if (!Array.isArray(manifest.apps) || manifest.apps.length < 15) throw new Error("Portfolio manifest is incomplete");

const ids = new Set();
for (const app of manifest.apps) {
  for (const key of ["id", "name", "source", "priority", "release_gate"]) {
    if (!app[key]) throw new Error(`Portfolio entry missing ${key}: ${app.id ?? "unknown"}`);
  }
  if (ids.has(app.id)) throw new Error(`Duplicate portfolio id: ${app.id}`);
  ids.add(app.id);
}

for (const required of [
  "izakhono-builder",
  "izakhono-nav",
  "i-connect",
  "izakhono-host",
  "fortress",
  "super-seo-v5",
  "facebook-google-parallel",
  "examready",
  "allegro-vibez",
  "business-of-music"
]) {
  if (!ids.has(required)) throw new Error(`Required portfolio product missing: ${required}`);
}

if (/public_live\s*:\s*true/i.test(JSON.stringify(manifest))) {
  throw new Error("Portfolio manifest must not claim public-live without runtime evidence");
}

console.log(`[PASS] IZAKHONO portfolio release manifest validated: ${manifest.apps.length} products.`);
console.log("[PASS] Public-live claims remain locked behind runtime verification.");
console.log("[PASS] Portfolio is governed as one factory release surface.");
