import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ledgerPath = 'products/topic-pdfs/products/TPDF-001-source-ledger.json';
const metadataPath = 'products/topic-pdfs/products/TPDF-001-household-budget.json';
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

assert.equal(ledger.schema, 'izakhono.topic-pdf-evidence-ledger/v1');
assert.equal(ledger.product_id, metadata.product_id);
assert.ok(Array.isArray(ledger.sources) && ledger.sources.length >= 2);
assert.ok(Array.isArray(ledger.claims) && ledger.claims.length >= 1);

const sourceIds = new Set();
for (const source of ledger.sources) {
  assert.match(source.source_id, /^S[0-9]{3,}$/);
  assert.ok(!sourceIds.has(source.source_id), 'Duplicate source ID: ' + source.source_id);
  sourceIds.add(source.source_id);
  assert.ok(source.title && source.publisher && source.jurisdiction && source.source_type);
  assert.match(source.url, /^https:\/\//, 'Source must use HTTPS: ' + source.source_id);
  assert.ok(['pending', 'verified', 'stale', 'inaccessible', 'contradicted', 'rejected'].includes(source.verification_status));
  if (source.verification_status === 'verified') {
    assert.ok(source.reviewer && source.reviewed_on && source.relevant_passages.length > 0,
      'Verified sources require a named human reviewer, date and passage locator.');
  }
}
const claimIds = new Set();
for (const claim of ledger.claims) {
  assert.match(claim.claim_id, /^CLAIM-[0-9]{3,}$/);
  assert.ok(!claimIds.has(claim.claim_id), 'Duplicate claim ID: ' + claim.claim_id);
  claimIds.add(claim.claim_id);
  assert.ok(claim.draft_location && claim.claim_summary && claim.verification_status);
  assert.ok(Array.isArray(claim.source_ids) && claim.source_ids.length > 0);
  for (const sourceId of claim.source_ids) assert.ok(sourceIds.has(sourceId), 'Unknown source ID: ' + sourceId);
}
for (const source of ledger.sources) {
  for (const claimId of source.claims_supported) assert.ok(claimIds.has(claimId), 'Unknown claim ID: ' + claimId);
}
assert.equal(metadata.sources.length, ledger.sources.length, 'Product metadata and internal ledger must list the same number of sources.');
const ledgerUrls = new Set(ledger.sources.map(source => source.url));
for (const source of metadata.sources) assert.ok(ledgerUrls.has(source.url), 'Metadata source missing from ledger: ' + source.url);

if (ledger.status !== 'verified-for-editorial-review') {
  assert.ok(ledger.sources.every(source => source.verification_status !== 'verified') || ledger.status === 'research-verification-pending',
    'Do not imply the ledger passed verification while overall status is pending.');
}
console.log('TPDF-001 evidence source ledger checks passed.');
