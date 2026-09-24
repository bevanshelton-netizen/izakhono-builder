import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(here, "capabilities.json"), "utf8"));

export function resolvePlatform(platformId) {
  const profileName = registry.platforms[platformId] || "default";
  const profile = registry.profiles[profileName] || registry.profiles.default;
  const capabilities = Object.entries(registry.capabilities).map(([key, value]) => ({
    key,
    ...value,
    required: registry.baseline.includes(key)
  }));
  const blockers = capabilities
    .filter((c) => c.required && c.status !== "verified")
    .map((c) => ({ capability: c.key, status: c.status, gate: c.production_gate }));
  return {
    fabric: registry.name,
    version: registry.version,
    platform_id: platformId,
    profile: profileName,
    baseline: [...registry.baseline],
    extra_modules: [...(profile.extra || [])],
    scale_claim: registry.scale_claim,
    capabilities,
    blockers,
    public_live_implied: false
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const platformId = (process.argv[2] || "default").trim();
  process.stdout.write(JSON.stringify(resolvePlatform(platformId), null, 2) + "\n");
}
