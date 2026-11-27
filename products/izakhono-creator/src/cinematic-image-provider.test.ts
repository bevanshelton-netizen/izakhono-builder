import assert from 'node:assert/strict';
import { chooseProvider, createAdapters, type GenerationRequest } from './provider-router';

const request: GenerationRequest = {
  kind: 'image',
  prompt: 'Original fictional South African drama character portrait; no real-person likeness.',
  aspectRatio: '9:16',
};

const unavailable = chooseProvider(request, createAdapters({}), 'luma');
assert.equal(unavailable, null, 'image generation remains unavailable without a server-side provider credential');

const configured = chooseProvider(request, createAdapters({ LUMA_API_KEY: 'test-only-not-a-real-key' }), 'luma');
assert.equal(configured?.id, 'luma', 'Luma is selected as the configured image-generation adapter');

const videoOnly = chooseProvider(request, createAdapters({ RUNWAY_API_KEY: 'test-only-not-a-real-key' }), 'runway');
assert.equal(videoOnly, null, 'video-only providers cannot be selected for image generation');

console.log('Cinematic image provider routing contract: PASS');
