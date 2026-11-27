import assert from 'node:assert/strict';
import { topicPdfFulfilmentRoute } from './topic-pdf-fulfilment-api';

const token = 'a'.repeat(64);
const entitlement = {
  entitlement_id: 'ent_1',
  publication_id: 'pub_1',
  slug: 'guide-for-readers-12345678',
  title: 'A Practical Guide',
  storage_key: 'topic-pdfs/pub_1/release.pdf',
};

function fakeEnv(options: { entitlement?: any; items?: any[]; bucket?: boolean } = {}) {
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      const bound = {
        values: [] as unknown[],
        bind(...values: unknown[]) { this.values = values; return this; },
        async first() {
          if (sql.includes('FROM builder_customer_sessions')) return { id: 'customer_1', email: 'reader@example.test', display_name: 'Reader', organization: '', status: 'active', session_id: 'session_1' };
          if (sql.includes('FROM topic_pdf_customer_entitlements')) return options.entitlement === undefined ? entitlement : options.entitlement;
          return null;
        },
        async all() { return { results: options.items || [] }; },
        async run() { return { success: true }; },
      };
      return bound;
    },
  };
  const env: any = { DB: db };
  if (options.bucket !== false) {
    env.TOPIC_PDF_BUCKET = {
      async get(key: string) {
        assert.equal(key, entitlement.storage_key);
        return { body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('%PDF-test')); controller.close(); } }), size: 9 };
      },
    };
  }
  return { env, statements };
}

async function main() {
  const url = new URL('https://guides.example.test/api/topic-pdfs/library');
  const unauth = await topicPdfFulfilmentRoute(new Request(url), fakeEnv().env, url);
  assert.equal(unauth?.status, 401);

  const libraryEnv = fakeEnv({ items: [{ slug: entitlement.slug, title: entitlement.title }] }).env;
  const library = await topicPdfFulfilmentRoute(
    new Request(url, { headers: { authorization: 'Bearer ' + token } }),
    libraryEnv,
    url,
  );
  assert.equal(library?.status, 200);
  assert.deepEqual((await library!.json() as any).items, [{ slug: entitlement.slug, title: entitlement.title }]);

  const downloadUrl = new URL('https://guides.example.test/api/topic-pdfs/download/' + entitlement.slug);
  const downloadEnv = fakeEnv().env;
  const download = await topicPdfFulfilmentRoute(
    new Request(downloadUrl, { headers: { authorization: 'Bearer ' + token } }),
    downloadEnv,
    downloadUrl,
  );
  assert.equal(download?.status, 200);
  assert.equal(download?.headers.get('content-type'), 'application/pdf');
  assert.match(download?.headers.get('content-disposition') || '', /attachment/);
  assert.equal(download?.headers.get('cache-control'), 'private, no-store, max-age=0');

  const noEntitlementEnv = fakeEnv({ entitlement: null }).env;
  const denied = await topicPdfFulfilmentRoute(
    new Request(downloadUrl, { headers: { authorization: 'Bearer ' + token } }),
    noEntitlementEnv,
    downloadUrl,
  );
  assert.equal(denied?.status, 404);

  const crossOrigin = await topicPdfFulfilmentRoute(
    new Request(downloadUrl, { headers: { authorization: 'Bearer ' + token, origin: 'https://attacker.example' } }),
    fakeEnv().env,
    downloadUrl,
  );
  assert.equal(crossOrigin?.status, 403);

  const missingBucket = await topicPdfFulfilmentRoute(
    new Request(downloadUrl, { headers: { authorization: 'Bearer ' + token } }),
    fakeEnv({ bucket: false }).env,
    downloadUrl,
  );
  assert.equal(missingBucket?.status, 503);

  console.log('Topic PDF customer fulfilment tests passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
