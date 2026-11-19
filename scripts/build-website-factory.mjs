import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'website-factory', 'index.html');
const destination = path.join(root, 'public', 'website-factory', 'index.html');
if (!fs.existsSync(source)) throw new Error('website-factory-source-missing');
const html = fs.readFileSync(source, 'utf8');
if (!html.includes('href="/#buildAnything"') || html.includes('innerHTML') || html.includes('localStorage') || html.includes('/api/build-anything')) {
  throw new Error('website-factory-must-use-authenticated-builder-api-and-safe-dom-rendering');
}
fs.mkdirSync(path.dirname(destination), { recursive: true });
const temporary = destination + '.tmp-' + process.pid;
fs.writeFileSync(temporary, html, { flag: 'w' });
fs.renameSync(temporary, destination);
if (fs.readFileSync(destination, 'utf8') !== html) throw new Error('website-factory-asset-copy-verification-failed');
console.log('[PASS] Website Factory owner-authenticated Builder asset published to public/website-factory/index.html');
