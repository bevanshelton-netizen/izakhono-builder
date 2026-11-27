import assert from 'node:assert/strict';
import { processOneApprovedTopicPdfJob, processOneSaleEditionTopicPdfJob, processOneTopicPdfJob, topicPdfOwnerReviewRoute } from './topic-pdf-generation-worker';

class FakeDB {
  calls = 0;
  prepare(_sql: string) {
    this.calls++;
    return {
      bind(..._values: unknown[]) { return this; },
      async first<T>() { return null as T | null; },
      async run() { return {}; },
    };
  }
}

async function main() {
  const db = new FakeDB();
  const disabled = await processOneTopicPdfJob({ DB: db, TOPIC_PDF_PIPELINE_ENABLED: 'false' });
  assert.deepEqual(disabled, { processed: false, reason: 'pipeline-disabled' });
  assert.equal(db.calls, 0);

  const missingProvider = await processOneTopicPdfJob({ DB: db, TOPIC_PDF_PIPELINE_ENABLED: 'true' });
  assert.deepEqual(missingProvider, { processed: false, reason: 'research-or-ai-provider-not-configured' });
  assert.equal(db.calls, 0);

  const configured = await processOneTopicPdfJob({
    DB: db,
    TOPIC_PDF_PIPELINE_ENABLED: 'true',
    TOPIC_PDF_RESEARCH_URL: 'https://research.example.test',
    TOPIC_PDF_RESEARCH_KEY: 'test-key',
    IZAKHONO_SUPER_AI_URL: 'https://ai.example.test',
    IZAKHONO_SUPER_AI_INTERNAL_KEY: 'internal-test-key',
    IZAKHONO_SUPER_AI_WORKFLOW_KEY: 'workflow-test-key',
  });
  assert.deepEqual(configured, { processed: false, reason: 'queue-empty' });
  assert.equal(db.calls, 1);

  const noRenderer = await processOneApprovedTopicPdfJob({ DB: db, TOPIC_PDF_PIPELINE_ENABLED: 'true' });
  assert.deepEqual(noRenderer, { processed: false, reason: 'private-renderer-or-object-storage-not-configured' });

  const saleDisabled = await processOneSaleEditionTopicPdfJob({ DB: db, TOPIC_PDF_PIPELINE_ENABLED: 'true', TOPIC_PDF_SALE_RELEASE_ENABLED: 'false' });
  assert.deepEqual(saleDisabled, { processed: false, reason: 'sale-edition-release-disabled' });
  const saleNotConfigured = await processOneSaleEditionTopicPdfJob({ DB: db, TOPIC_PDF_PIPELINE_ENABLED: 'true', TOPIC_PDF_SALE_RELEASE_ENABLED: 'true' });
  assert.deepEqual(saleNotConfigured, { processed: false, reason: 'separate-release-renderer-or-private-storage-not-configured' });

  const url = new URL('https://example.test/api/owner/topic-pdfs/review-queue');
  const unauthorized = await topicPdfOwnerReviewRoute(
    new Request(url),
    { DB: db },
    url,
    async () => false,
  );
  assert.equal(unauthorized?.status, 401);

  const salePreviewUrl = new URL('https://example.test/api/owner/topic-pdfs/publications/pub_12345678/preview');
  const missingSalePreview = await topicPdfOwnerReviewRoute(
    new Request(salePreviewUrl),
    { DB: db, TOPIC_PDF_BUCKET: { async get() { return null; } } },
    salePreviewUrl,
    async () => true,
  );
  assert.equal(missingSalePreview?.status, 404);

  const publishUrl = new URL('https://example.test/api/owner/topic-pdfs/publications/pub_12345678/publish');
  const noSaleCandidate = await topicPdfOwnerReviewRoute(
    new Request(publishUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmPublication: true }) }),
    { DB: db, TOPIC_PDF_BUCKET: { async get() { return null; } } },
    publishUrl,
    async () => true,
  );
  assert.equal(noSaleCandidate?.status, 409);

  const releaseDb = {
    prepare(sql: string) {
      return {
        bind(..._values: unknown[]) { return this; },
        async first<T>() {
          let row: any = null;
          if (sql.includes('SELECT p.id,p.job_id,p.status,p.sale_storage_key')) {
            row = { id: 'pub_12345678', job_id: 'job_12345678', status: 'approved', sale_storage_key: 'topic-pdfs/job_12345678/sale-edition/release.pdf', sale_sha256: 'sha-test', sale_bytes: 100, job_status: 'approved', plan_json: JSON.stringify({ risk: { requiresSpecialistReview: false } }) };
          } else if (sql.includes('SELECT decision,rights_reviewed')) {
            row = { decision: 'approved', rights_reviewed: 1, factual_review_passed: 1, specialist_review_passed: 0, editorial_approved: 1 };
          } else if (sql.includes('SELECT status FROM topic_pdf_publications')) {
            row = { status: 'published' };
          }
          return row as T | null;
        },
        async run() { return {}; },
      };
    },
  };
  const releaseBucket = {
    async get() {
      return {
        size: 100,
        customMetadata: { status: 'sale-edition-candidate-not-published', sha256: 'sha-test' },
        body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); } }),
      };
    },
  };
  const published = await topicPdfOwnerReviewRoute(
    new Request(publishUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmPublication: true }) }),
    { DB: releaseDb, TOPIC_PDF_BUCKET: releaseBucket },
    publishUrl,
    async () => true,
  );
  assert.equal(published?.status, 200);
  assert.equal((await published!.json() as any).publication.status, 'published');

  const unrelated = await topicPdfOwnerReviewRoute(
    new Request('https://example.test/other'),
    { DB: db },
    new URL('https://example.test/other'),
    async () => false,
  );
  assert.equal(unrelated, null);

  console.log('Topic PDF generation worker guard tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
