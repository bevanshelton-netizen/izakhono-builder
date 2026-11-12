const path = require('path');

const PRIVATE_FILES = new Set([
  'server.js', 'package.json', 'package-lock.json', 'dockerfile',
  'docker-compose.yml', '.dockerignore', '.npmrc'
]);
const PRIVATE_DIRS = new Set(['scripts', 'tests', 'migrations', 'node_modules', '.git']);

function isPrivateStaticPath(requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(String(requestPath || '/')); } catch { return true; }
  const normalised = decoded.replace(/\\/g, '/').toLowerCase();
  const segments = normalised.split('/').filter(Boolean);
  if (segments.some(segment => segment.startsWith('.env') || PRIVATE_DIRS.has(segment))) return true;
  const basename = path.posix.basename(normalised);
  if (PRIVATE_FILES.has(basename)) return true;
  return /\.(?:md|sql|ya?ml|map|log)$/i.test(basename);
}

module.exports = { isPrivateStaticPath };
