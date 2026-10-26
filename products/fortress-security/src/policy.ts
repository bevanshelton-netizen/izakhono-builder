import type { ScanScope } from './types.js';

const PRIVATE_OR_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function validateScope(scope: ScanScope): void {
  if (process.env.FORTRESS_AUTHORIZED_SCAN !== '1') {
    throw new Error('Blocked: set FORTRESS_AUTHORIZED_SCAN=1 for an explicitly authorized defensive scan.');
  }
  if (!scope.owner.trim()) throw new Error('Scan scope owner is required.');
  if (!scope.assets.length) throw new Error('Scan scope must contain at least one explicitly authorized asset.');

  for (const asset of scope.assets) {
    if (!asset.id.trim() || !asset.host.trim()) throw new Error('Each asset requires an id and host.');
    if (!asset.ports.length) throw new Error(`Asset ${asset.id} has no explicit ports.`);
    for (const port of asset.ports) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Asset ${asset.id} contains invalid port ${port}.`);
      }
    }
    for (const url of asset.httpUrls ?? []) {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Unsupported protocol in ${url}.`);
      }
      if (!hostMatches(asset.host, parsed.hostname)) {
        throw new Error(`HTTP URL ${url} is outside the declared asset host ${asset.host}.`);
      }
    }
  }
}

function hostMatches(declared: string, actual: string): boolean {
  const a = declared.replace(/^\[|\]$/g, '').toLowerCase();
  const b = actual.replace(/^\[|\]$/g, '').toLowerCase();
  return a === b || (PRIVATE_OR_LOCAL_HOSTS.has(a) && PRIVATE_OR_LOCAL_HOSTS.has(b));
}
