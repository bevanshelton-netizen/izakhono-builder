import assert from 'node:assert/strict';
import { cinematicStudioHtml } from './cinematic-studio';

const script = cinematicStudioHtml.match(/<script>([\\s\\S]*?)<\\/script>/)?.[1];
assert.ok(script, 'Cinematic Studio must include its application script.');
assert.doesNotThrow(() => new Function(script), 'Cinematic Studio browser script must parse.');
assert.match(cinematicStudioHtml, /FORTRESS sign-in required/);
assert.match(cinematicStudioHtml, /api\\/cinematic\\/session/);
assert.match(cinematicStudioHtml, /__Host-izakhono_csrf/);
assert.doesNotMatch(cinematicStudioHtml, /CREATOR_GENERATION_SECRET|MEDIA_FABRIC_KEY/);
assert.match(cinematicStudioHtml, /noindex,nofollow/);
console.log('Cinematic Studio browser contract tests: PASS');
