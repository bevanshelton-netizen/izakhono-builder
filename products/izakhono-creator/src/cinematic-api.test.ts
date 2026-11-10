import assert from 'node:assert/strict';
import { handleCinematicApi } from './cinematic-api';

async function run() {
  const missingSecret = await handleCinematicApi(
    new Request('https://creator.example/api/cinematic/projects', { method: 'GET' }),
    {},
  );
  assert.equal(missingSecret?.status, 503, 'cinematic API fails closed when its server secret is absent');

  const unauthorized = await handleCinematicApi(
    new Request('https://creator.example/api/cinematic/projects', { method: 'GET' }),
    { CREATOR_GENERATION_SECRET: 'server-only-secret' },
  );
  assert.equal(unauthorized?.status, 401, 'cinematic API rejects requests without the server credential');

  const noDatabase = await handleCinematicApi(
    new Request('https://creator.example/api/cinematic/projects', {
      method: 'GET',
      headers: { 'x-creator-generation-secret': 'server-only-secret' },
    }),
    { CREATOR_GENERATION_SECRET: 'server-only-secret' },
  );
  assert.equal(noDatabase?.status, 503, 'cinematic API does not pretend persistence exists without D1');

  const unrelated = await handleCinematicApi(
    new Request('https://creator.example/api/projects'),
    { CREATOR_GENERATION_SECRET: 'server-only-secret' },
  );
  assert.equal(unrelated, null, 'non-cinematic routes remain owned by the existing Creator router');

  console.log('Cinematic API security boundary tests passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
