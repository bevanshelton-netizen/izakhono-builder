import assert from 'node:assert/strict';
import { topicPdfRequestRoute } from './topic-pdf-request-api';

class FakeDB {
  writes = 0;
  prepare(_sql: string) {
    const self = this;
    return {
      bind(..._values: unknown[]) { return this; },
      async first<T>() { return null as T | null; },
      async run() { self.writes++; return {}; },
    };
  }
}

async function main() {
  const db = new FakeDB();
  const url = new URL('https://example.test/api/topic-pdfs/requests');
  const disabled = await topicPdfRequestRoute(new Request(url), { DB: db }, url);
  assert.equal(disabled?.status, 503);

  const unauthorized = await topicPdfRequestRoute(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        topic: 'Starting a small business in Kenya',
        readerOutcome: 'Understand the steps to plan and launch a small business.',
        audience: 'First-time founders',
        language: 'English',
      }),
    }),
    { DB: db, TOPIC_PDF_REQUESTS_ENABLED: 'true' },
    url,
  );
  assert.equal(unauthorized?.status, 401);
  assert.equal(db.writes, 0);

  const unrelated = await topicPdfRequestRoute(
    new Request('https://example.test/api/other'),
    { DB: db, TOPIC_PDF_REQUESTS_ENABLED: 'true' },
    new URL('https://example.test/api/other'),
  );
  assert.equal(unrelated, null);
  console.log('topic PDF request API guard tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
