import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(here, "platform-identities.json"), "utf8"));
const rows = [["platform_id","platform_name","role","address","exposure","operator"]];

for (const p of cfg.platforms) {
  const domain = p.domain || cfg.shared_domain;
  const operator = p.operator || cfg.operator;
  const roles = p.dedicated
    ? {
        primary: `${p.slug}@${domain}`,
        support: `support@${domain}`,
        partnerships: `partnerships@${domain}`,
        accounts: `accounts@${domain}`,
        noreply: `noreply@${domain}`
      }
    : {
        primary: `${p.slug}@${domain}`,
        support: `${p.slug}-support@${domain}`,
        partnerships: `${p.slug}-partners@${domain}`,
        accounts: `${p.slug}-accounts@${domain}`,
        noreply: `noreply-${p.slug}@${domain}`
      };

  for (const [role,address] of Object.entries(roles)) {
    rows.push([p.id,p.name,role,address,p.exposure,operator]);
  }
}

const csv = rows.map(row => row.map(v => '"' + String(v).replaceAll('"','""') + '"').join(",")).join("\n") + "\n";
const out = path.join(here, "generated-addresses.csv");
fs.writeFileSync(out, csv);
console.log(`Wrote ${out} with ${rows.length - 1} role addresses`);
