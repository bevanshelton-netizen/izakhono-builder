import assert from 'node:assert/strict';
import { processOneTopicPdfJob, topicPdfOwnerReviewRoute } from './topic-pdf-generation-worker';

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

  const url = new URL('https://example.test/api/owner/topic-pdfs/review-queue');
  const unauthorized = await topicPdfOwnerReviewRoute(
    new Request(url),
    { DB: db },
    url,
    async () => false,
  );
  assert.equal(unauthorized?.status, 401);

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
