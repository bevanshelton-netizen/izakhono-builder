import assert from 'node:assert/strict';
import { cinematicStudioHtml } from './cinematic-studio';

const scriptStart = cinematicStudioHtml.indexOf('<script>');
const scriptEnd = cinematicStudioHtml.lastIndexOf('</script>');
assert.ok(scriptStart >= 0 && scriptEnd > scriptStart, 'Cinematic Studio must include its application script.');
const script = cinematicStudioHtml.slice(scriptStart + '<script>'.length, scriptEnd);
assert.doesNotThrow(() => new Function(script), 'Cinematic Studio browser script must parse.');
assert.ok(cinematicStudioHtml.includes('FORTRESS sign-in required'));
assert.ok(cinematicStudioHtml.includes('/api/cinematic/session'));
assert.ok(cinematicStudioHtml.includes('__Host-izakhono_csrf'));
assert.ok(!cinematicStudioHtml.includes('CREATOR_GENERATION_SECRET'));
assert.ok(!cinematicStudioHtml.includes('MEDIA_FABRIC_KEY'));
assert.ok(cinematicStudioHtml.includes('noindex,nofollow'));
assert.ok(cinematicStudioHtml.includes('Production readiness'), 'Studio must expose its production readiness workspace panel.');
assert.ok(cinematicStudioHtml.includes('function renderReadiness()'), 'Studio must render readiness actions and evidence counts.');
assert.ok(cinematicStudioHtml.includes('candidateTaskIds'), 'Studio must display candidate task links from the readiness report.');
console.log('Cinematic Studio browser contract tests: PASS');

assert.ok(cinematicStudioHtml.includes('Verified production evidence'), 'Studio must expose completed evidence records.');
assert.ok(cinematicStudioHtml.includes('readinessEvidence'), 'Studio must render the evidence audit list.');
