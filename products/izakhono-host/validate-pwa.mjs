import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const manifestPath = path.join(publicDir, 'manifest.webmanifest');
const indexPath = path.join(publicDir, 'index.html');
const workerPath = path.join(publicDir, 'service-worker.js');

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const index = fs.readFileSync(indexPath, 'utf8');
const worker = fs.readFileSync(workerPath, 'utf8');

requireCheck(manifest.name === 'IZAKHONO Business Creation Engine', 'PWA canonical name mismatch');
requireCheck(manifest.short_name === 'IZAKHONO', 'PWA short name mismatch');
requireCheck(manifest.display === 'standalone', 'PWA must launch in standalone mode');
requireCheck(typeof manifest.scope === 'string' && manifest.scope.startsWith('/'), 'PWA scope must be root-relative');
requireCheck(typeof manifest.start_url === 'string', 'PWA start_url is required');

const appOrigin = 'https://izakhono.invalid';
const scopeUrl = new URL(manifest.scope, appOrigin);
const startUrl = new URL(manifest.start_url, appOrigin);
requireCheck(startUrl.origin === scopeUrl.origin && startUrl.pathname.startsWith(scopeUrl.pathname), 'PWA start_url must remain inside its scope');
requireCheck(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'PWA requires regular and maskable launcher icons');

for (const icon of manifest.icons) {
  requireCheck(typeof icon.src === 'string' && icon.src.startsWith('/'), 'PWA icon paths must be root-relative');
  requireCheck(icon.type === 'image/svg+xml', 'PWA icon MIME type must match SVG resources');
  const iconPath = path.join(publicDir, icon.src.replace(/^\//, ''));
  requireCheck(fs.existsSync(iconPath), `PWA icon resource missing: ${icon.src}`);
  const svg = fs.readFileSync(iconPath, 'utf8');
  requireCheck(/<svg\b/.test(svg) && /viewBox=/.test(svg), `PWA icon is not a scalable SVG: ${icon.src}`);
  if (String(icon.purpose).includes('maskable')) {
    requireCheck(/<svg\b/.test(svg), 'Maskable launcher icon must be an SVG image');
  }
}

requireCheck(index.includes('rel="manifest" href="/manifest.webmanifest"'), 'App shell must link the PWA manifest');
requireCheck(index.includes("navigator.serviceWorker.register('/service-worker.js'"), 'App shell must register its service worker');
requireCheck(index.includes("location.protocol === 'https:'"), 'Service worker registration must be HTTPS-only');
requireCheck(worker.includes("request.method !== 'GET'"), 'Service worker must bypass non-GET requests');
requireCheck(worker.includes("url.origin !== self.location.origin"), 'Service worker must bypass cross-origin requests');
requireCheck(worker.includes("url.pathname.startsWith('/api/')"), 'Service worker must explicitly bypass API responses');
requireCheck(worker.includes("url.pathname.startsWith('/auth/')"), 'Service worker must explicitly bypass authentication responses');
requireCheck(!/SHELL\s*=\s*\[[^\]]*\/api\//s.test(worker), 'API routes must never enter the offline shell cache');

console.log(JSON.stringify({
  status: 'passed',
  app: manifest.name,
  display: manifest.display,
  icons: manifest.icons.length,
  serviceWorker: 'https-only; same-origin GET shell; API/auth excluded',
}, null, 2));
