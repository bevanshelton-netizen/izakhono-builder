import assert from 'node:assert/strict';
import { handleCinematicApi } from './cinematic-api';
import { compileCinematicBrief } from './cinematic-brief-compiler';
import { saveProject } from './project-store';

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


  let projectRow: Record<string, unknown> | null = null;
  const DB = {
    async batch() { return {}; },
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.startsWith('SELECT * FROM creator_projects')) return projectRow as T | null;
              return null;
            },
            async run() {
              if (query.startsWith('INSERT INTO creator_projects')) {
                projectRow = {
                  id: values[0], brief: values[1], package_json: values[2],
                  created_at: values[3], updated_at: values[4],
                };
              }
              return {};
            },
            async all<T>() { return { results: [] as T[] }; },
          };
        },
      };
    },
  };
  const compiled = compileCinematicBrief({ id: 'qa-project', ownerId: 'owner-1', brief: 'A short documentary film', createdAt: '2026-11-26T09:00:00.000Z' });
  const graph = {
    ...compiled.production,
    assets: [{
      id: 'facebook-export', kind: 'video' as const, status: 'completed' as const,
      source: 'assembled' as const, role: 'distribution_export' as const,
      storageKey: 'projects/qa-project/facebook.mp4', contentHash: 'c'.repeat(64),
      parentAssetIds: [],
      provenance: { createdAt: '2026-11-26T09:00:00.000Z', licence: 'owned', consentRecordIds: [] },
    }],
  };
  const env = { DB, CREATOR_GENERATION_SECRET: 'server-only-secret' };
  await saveProject(env, { id: 'qa-project', brief: graph.brief, packageData: { cinematicProduction: graph } });
  const checks = [
    'container-mp4', 'duration-positive', 'video-stream-present', 'video-stream-count',
    'video-h264', 'video-dimensions', 'video-pixel-format', 'video-frame-rate',
    'audio-stream-present', 'audio-stream-count', 'audio-aac', 'audio-sample-rate',
    'audio-stereo', 'mp4-fast-start',
  ].map(id => ({ id, passed: true, actual: 'verified', expected: 'Facebook Reels profile requirement' }));
  const evidence = {
    schema: 'izakhono.creator/media-qa-evidence-v1' as const,
    profileId: 'facebook-reels-1080x1920-v1',
    passed: true,
    assetContentHash: 'c'.repeat(64),
    recordedAt: '2026-11-26T09:10:00.000Z',
    recordedBy: 'qa-worker-1',
    checks,
  };
  const recorded = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/assets/facebook-export/media-qa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ evidence }),
  }), env);
  assert.equal(recorded?.status, 200, 'authenticated QA worker can record verified export evidence');
  const persisted = JSON.parse(String(projectRow?.package_json)) as { cinematicProduction: { assets: Array<{ id: string; mediaQa?: { passed: boolean; assetContentHash: string } }> } };
  const persistedAsset = persisted.cinematicProduction.assets.find(asset => asset.id === 'facebook-export');
  assert.equal(persistedAsset?.mediaQa?.passed, true, 'QA evidence is persisted in the canonical production graph');
  assert.equal(persistedAsset?.mediaQa?.assetContentHash, 'c'.repeat(64), 'persisted evidence remains bound to the exact export hash');


  const persistedGraph = persisted.cinematicProduction;
  const alteredEvidenceGraph = {
    ...persistedGraph,
    assets: persistedGraph.assets.map(asset => asset.id === 'facebook-export' ? {
      ...asset, mediaQa: { ...asset.mediaQa!, recordedBy: 'spoofed-worker' },
    } : asset),
  };
  const bypassAttempt = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ production: alteredEvidenceGraph }),
  }), env);
  assert.equal(bypassAttempt?.status, 409, 'general graph PATCH cannot forge or alter machine QA evidence');

  const mismatched = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/assets/facebook-export/media-qa', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ evidence: { ...evidence, assetContentHash: 'd'.repeat(64) } }),
  }), env);
  assert.equal(mismatched?.status, 400, 'API rejects evidence for different export bytes');


  let storedGraph = JSON.parse(String(projectRow?.package_json)).cinematicProduction;
  storedGraph = {
    ...storedGraph,
    approvals: storedGraph.approvals.map((item: any) => item.gate === 'master'
      ? { ...item, status: 'approved', approverId: 'producer-1', decidedAt: '2026-11-26T09:00:00.000Z' }
      : item),
  };
  await saveProject(env, { id: 'qa-project', brief: storedGraph.brief, packageData: { cinematicProduction: storedGraph } });
  const distributionBeforeHumanReview = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/approvals/distribution', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ approverId: 'publisher-1', decision: 'approved' }),
  }), env);
  assert.equal(distributionBeforeHumanReview?.status, 409, 'distribution approval is blocked until human review passes');

  const humanReview = {
    schema: 'izakhono.creator/human-media-review-v1',
    profileId: 'facebook-reels-1080x1920-v1',
    reviewId: 'review-api-001',
    passed: true,
    recordedAt: '2026-11-26T09:20:00.000Z',
    recordedBy: 'human-reviewer-1',
    checks: [
      { id: 'full-playback-integrity', passed: true, finding: 'Full playback reviewed without freezes or black frames.' },
      { id: 'dialogue-music-effects', passed: true, finding: 'Dialogue, music and effects reviewed for clarity and sync.' },
      { id: 'captions-safe-areas', passed: true, finding: 'Captions and mobile safe areas reviewed.' },
      { id: 'continuity-titles-credits', passed: true, finding: 'Continuity, titles, credits and end card reviewed.' },
      { id: 'private-upload-playback', passed: true, finding: 'Private staging upload played back successfully.' },
    ],
  };
  const humanReviewResponse = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/assets/facebook-export/human-review', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ evidence: humanReview }),
  }), env);
  assert.equal(humanReviewResponse?.status, 200, 'authenticated reviewer can append a complete human review');
  storedGraph = JSON.parse(String(projectRow?.package_json)).cinematicProduction;
  assert.equal(storedGraph.assets[0].humanReviews?.[0]?.reviewId, 'review-api-001', 'human review is persisted on the canonical export asset');

  const tamperedReviewGraph = {
    ...storedGraph,
    assets: storedGraph.assets.map((asset: any) => asset.id === 'facebook-export'
      ? { ...asset, humanReviews: [{ ...humanReview, recordedBy: 'spoofed-reviewer' }] }
      : asset),
  };
  const reviewBypass = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ production: tamperedReviewGraph }),
  }), env);
  assert.equal(reviewBypass?.status, 409, 'generic graph PATCH cannot forge or replace human review history');

  const distributionAfterHumanReview = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/approvals/distribution', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ approverId: 'publisher-1', decision: 'approved' }),
  }), env);
  assert.equal(distributionAfterHumanReview?.status, 200, 'distribution approval succeeds after machine QA and human review pass');

  console.log('Cinematic API security boundary tests passed.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
