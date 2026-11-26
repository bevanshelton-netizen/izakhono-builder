import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8');

assert.match(source, /fetch\("\/api\/health"/);
assert.match(source, /fetch\(searchUrl/);
assert.match(source, /\/api\/route\/driving\//);
assert.match(source, /navigator\.geolocation\.getCurrentPosition/);
assert.match(source, /if\(!start\)throw new Error/);
assert.match(source, /if\(!searchResponse\.ok\)throw new Error/);
assert.match(source, /if\(!routeResponse\.ok\|\|!route\.geometry\?\.coordinates\?\.length\)throw new Error/);
assert.match(source, /function escapeHtml\(/);
assert.match(source, /function routeOverlay\\(/);\nassert.match(source, /activeRoute\\?\\.geometry\\?\\.coordinates/);\nassert.match(source, /escapeHtml\\(destination\\)/);\nassert.match(source, /routeStatus="ROUTE NOT CALCULATED"/);
assert.doesNotMatch(source, /DEMO ROUTE|demo route remains active|350 m|18\.4 km/);
console.log('NAV client live-engine contract: PASS');
