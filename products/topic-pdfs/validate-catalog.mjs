import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const path = new URL("./topics.candidates.json", import.meta.url);
const catalog = JSON.parse(await readFile(path, "utf8"));

assert.equal(catalog.price_target_usd, 7, "Programme target price must be USD 7");
assert.equal(catalog.author, "Bevan Shelton");
assert.ok(Array.isArray(catalog.items) && catalog.items.length > 0);

const ids = new Set();
const slugs = new Set();
for (const item of catalog.items) {
  assert.match(item.product_id, /^TPDF-[A-Z0-9-]+$/);
  assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(!ids.has(item.product_id), `Duplicate product ID: ${item.product_id}`);
  assert.ok(!slugs.has(item.slug), `Duplicate slug: ${item.slug}`);
  ids.add(item.product_id);
  slugs.add(item.slug);
  assert.equal(item.status, "candidate", "Discovery queue entries must remain candidates");
  assert.equal(item.price_target_usd, 7);
  assert.equal(item.approved_for_drafting, false, "Candidates cannot be auto-approved for drafting");
  assert.equal(item.publication_status, "not-published", "Candidates cannot be represented as published");
  assert.ok(item.title && item.reader_profile && item.category);
}
console.log(`Validated ${catalog.items.length} candidate topic records; none is approved or published.`);
