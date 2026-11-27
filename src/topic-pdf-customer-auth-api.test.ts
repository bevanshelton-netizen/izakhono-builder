import assert from 'node:assert/strict';
import { getTopicPdfSessionToken, topicPdfCustomerAuthRoute } from './topic-pdf-customer-auth-api';

async function main() {
  const token = 'a'.repeat(64);
  assert.equal(getTopicPdfSessionToken(new Request('https://example.test', { headers: { authorization: 'Bearer ' + token } })), token);
  assert.equal(getTopicPdfSessionToken(new Request('https://example.test', { headers: { cookie: '__Host-topic_pdf_session=' + token + '; other=value' } })), token);
  assert.equal(getTopicPdfSessionToken(new Request('https://example.test', { headers: { cookie: '__Host-topic_pdf_session=not-a-token' } })), '');

  const url = new URL('https://example.test/api/topic-pdfs/customer/login');
  const disabled = await topicPdfCustomerAuthRoute(
    new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }),
    { DB: {} },
    url,
  );
  assert.equal(disabled?.status, 503);

  const configured = {
    DB: {},
    TOPIC_PDF_CUSTOMER_AUTH_ENABLED: 'true',
    TOPIC_PDF_EMAIL_URL: 'https://mail.example.test/send',
    TOPIC_PDF_EMAIL_KEY: 'test-mail-key',
    TOPIC_PDF_PUBLIC_BASE_URL: 'https://guides.example.test',
    TOPIC_PDF_AUTH_RATE_LIMIT_SECRET: 'test-rate-secret',
  };
  const crossOrigin = await topicPdfCustomerAuthRoute(
    new Request(url, {
      method: 'POST',
      headers: { origin: 'https://attacker.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'reader@example.test', password: 'not-a-real-password' }),
    }),
    configured,
    url,
  );
  assert.equal(crossOrigin?.status, 403);

  const unrelated = await topicPdfCustomerAuthRoute(
    new Request('https://example.test/not-an-auth-route'),
    configured,
    new URL('https://example.test/not-an-auth-route'),
  );
  assert.equal(unrelated, null);
  console.log('Topic PDF customer authentication guard tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
