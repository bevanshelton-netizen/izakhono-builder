import assert from 'node:assert/strict';
import { fallbackSiteBrief, normalizeBrief, resolveLocalModelConfig } from './model-runtime.mjs';
import { renderSite } from './site-renderer.mjs';

const fallback = fallbackSiteBrief('Build a school uniform ordering portal');
assert.equal(fallback.mode, 'deterministic-fallback');
assert.match(fallback.brief.description, /school uniform/);
assert.equal(fallback.brief.description, 'Build a school uniform ordering portal');
const normalized = normalizeBrief({ title: '<script>alert(1)</script>', sections: [{ heading: 'About', body: '<img src=x onerror=alert(1)>' }] }, 'Test');
const html = renderSite(normalized);
assert.ok(!html.includes('<script>alert(1)</script>'));
assert.ok(!html.includes('<img src=x'));
assert.match(html, /&lt;script&gt;/);
assert.throws(() => resolveLocalModelConfig({ IZAKHONO_LOCAL_MODEL_URL: 'https://example.com/api/chat' }), /not-private/);
assert.equal(resolveLocalModelConfig({}).model, 'qwen2.5-coder:3b');
console.log('[PASS] Native generation fallback, HTML escaping and local-only model routing verified.');
