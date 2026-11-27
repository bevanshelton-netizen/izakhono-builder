import assert from 'node:assert/strict';
import { handleCinematicApi } from './cinematic-api';
import { compileCinematicBrief } from './cinematic-brief-compiler';
import { saveProject } from './project-store';
import { buildProductionManifest } from './cinematic-production-manifest';

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
  const sourceObjects = new Map<string, Uint8Array>();
  const sourceEnv = {
    ...env,
    ASSETS: {
      async put(key: string, body: ReadableStream | null) {
        assert.ok(body, 'source upload stream is supplied to private object storage');
        const reader = body!.getReader();
        const chunks: Uint8Array[] = [];
        while (true) { const next = await reader.read(); if (next.done) break; chunks.push(next.value); }
        const total = chunks.reduce((sum, part) => sum + part.length, 0);
        const joined = new Uint8Array(total);
        let offset = 0;
        for (const part of chunks) { joined.set(part, offset); offset += part.length; }
        sourceObjects.set(key, joined);
      },
      async get() { return null; },
    },
  };
  const sourceBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04]);
  const sourceResponse = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/source-media', {
    method: 'POST',
    headers: {
      'content-type': 'image/png', 'content-length': String(sourceBytes.length),
      'x-creator-filename': 'cape-town-reference.png', 'x-creator-uploader-id': 'producer-1',
      'x-creator-licence': 'Original photograph supplied by production owner',
      'x-creator-consent-status': 'not_applicable',
      'x-creator-generation-secret': 'server-only-secret',
    }, body: sourceBytes,
  }), sourceEnv);
  assert.equal(sourceResponse?.status, 201, 'authenticated source media is ingested into private object storage');
  const sourcePayload = await sourceResponse!.json() as { asset: { id: string; storageKey: string; contentHash: string; sourceEvidence: { sha256: string; consentStatus: string; rightsReviewStatus: string } } };
  assert.equal(sourcePayload.asset.sourceEvidence.sha256, sourcePayload.asset.contentHash, 'source evidence hash matches graph asset hash');
  assert.equal(sourceObjects.has(sourcePayload.asset.storageKey), true, 'original bytes are stored under a project-scoped private key');
  assert.equal(sourcePayload.asset.sourceEvidence.consentStatus, 'not_applicable', 'consent status is explicitly recorded, not inferred');
  assert.equal(sourcePayload.asset.sourceEvidence.rightsReviewStatus, 'unverified', 'a declared licence is not mistaken for verified rights clearance');
  const sourcePersisted = JSON.parse(String(projectRow?.package_json)).cinematicProduction;
  assert.equal(buildProductionManifest(sourcePersisted).entries.find(entry => entry.id === sourcePayload.asset.id)?.state, 'missing', 'unreviewed source media remains blocked from manifest completion');
  const sourceAsset = sourcePersisted.assets.find((asset: any) => asset.id === sourcePayload.asset.id);
  assert.equal(sourceAsset.sourceEvidence.receivedBy, 'producer-1', 'source provenance is retained in the canonical graph');
  const rightsReviewEvidence = {
    schema: 'izakhono.creator/source-rights-review-v1' as const,
    reviewId: 'rights-review-1',
    assetContentHash: sourcePayload.asset.contentHash,
    decision: 'verified' as const,
    basis: 'Original source file and written rights declaration were checked against the production intake record.',
    evidenceReferences: ['intake-record-1', 'rights-declaration-1'],
    recordedAt: '2026-11-27T21:00:00.000Z',
    recordedBy: 'rights-reviewer-1',
  };
  const rightsReviewResponse = await handleCinematicApi(new Request(`https://creator.example/api/cinematic/projects/qa-project/assets/${sourcePayload.asset.id}/rights-review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ evidence: rightsReviewEvidence }),
  }), sourceEnv);
  assert.equal(rightsReviewResponse?.status, 200, 'authenticated rights-review endpoint records a hash-bound source decision');
  const rightsReviewPayload = await rightsReviewResponse!.json() as { rightsReviews: Array<{ decision: string; assetContentHash: string }> };
  assert.equal(rightsReviewPayload.rightsReviews.at(-1)?.decision, 'verified', 'latest rights decision is retained as append-only evidence');
  assert.equal(rightsReviewPayload.rightsReviews.at(-1)?.assetContentHash, sourcePayload.asset.contentHash, 'rights decision is bound to exact source bytes');
  const afterRightsReview = JSON.parse(String(projectRow?.package_json)).cinematicProduction;
  const sourceAfterReview = afterRightsReview.assets.find((asset: any) => asset.id === sourcePayload.asset.id);
  assert.equal(sourceAfterReview.sourceEvidence.rightsReviewStatus, 'unverified', 'original intake evidence remains immutable after review');
  assert.equal(sourceAfterReview.rightsReviews.length, 1, 'review is stored separately from immutable intake evidence');
  assert.equal(buildProductionManifest(afterRightsReview).entries.find(entry => entry.id === sourcePayload.asset.id)?.state, 'complete', 'a latest hash-matched verified decision clears the source-rights manifest gate');
  const rejectedDuplicateRightsReview = await handleCinematicApi(new Request(`https://creator.example/api/cinematic/projects/qa-project/assets/${sourcePayload.asset.id}/rights-review`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ evidence: rightsReviewEvidence }),
  }), sourceEnv);
  assert.equal(rejectedDuplicateRightsReview?.status, 400, 'duplicate rights-review IDs are rejected');

  const sourceRightsReviewForgery = {
    ...afterRightsReview,
    assets: afterRightsReview.assets.map((asset: any) => asset.id === sourcePayload.asset.id
      ? { ...asset, rightsReviews: [] } : asset),
  };
  const rightsForgeryResponse = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project', {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ production: sourceRightsReviewForgery }),
  }), sourceEnv);
  assert.equal(rightsForgeryResponse?.status, 409, 'generic graph PATCH cannot alter or remove source rights-review history');
  const sourceEvidenceForgery = {
    ...sourcePersisted,
    assets: sourcePersisted.assets.map((asset: any) => asset.id === sourcePayload.asset.id
      ? { ...asset, sourceEvidence: { ...asset.sourceEvidence, receivedBy: 'spoofed' } } : asset),
  };
  const sourceForgeryResponse = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project', {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-creator-generation-secret': 'server-only-secret' },
    body: JSON.stringify({ production: sourceEvidenceForgery }),
  }), sourceEnv);
  assert.equal(sourceForgeryResponse?.status, 409, 'generic graph PATCH cannot alter source intake evidence');
  const wrongSignature = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/source-media', {
    method: 'POST',
    headers: {
      'content-type': 'image/jpeg', 'content-length': String(sourceBytes.length),
      'x-creator-filename': 'mislabelled.jpg', 'x-creator-uploader-id': 'producer-1',
      'x-creator-licence': 'Declared source licence', 'x-creator-consent-status': 'unverified',
      'x-creator-generation-secret': 'server-only-secret',
    }, body: sourceBytes,
  }), sourceEnv);
  assert.equal(wrongSignature?.status, 415, 'source intake rejects a MIME type that does not match the file signature');
  const missingConsent = await handleCinematicApi(new Request('https://creator.example/api/cinematic/projects/qa-project/source-media', {
    method: 'POST',
    headers: {
      'content-type': 'image/png', 'content-length': String(sourceBytes.length),
      'x-creator-filename': 'no-consent.png', 'x-creator-uploader-id': 'producer-1',
      'x-creator-licence': 'Declared source licence', 'x-creator-consent-status': 'provided',
      'x-creator-generation-secret': 'server-only-secret',
    }, body: sourceBytes,
  }), sourceEnv);
  assert.equal(missingConsent?.status, 400, 'provided consent requires traceable consent record IDs');
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
    assetContentHash: 'c'.repeat(64),
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
