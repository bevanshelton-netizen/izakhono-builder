import fs from 'node:fs';
import path from 'node:path';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.mxf', '.webm']);

function insideVault(vaultDir, candidate) {
  const root = path.resolve(vaultDir);
  const target = path.resolve(root, candidate);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function inspectMedia({ vaultDir, relativePath }) {
  const result = {
    path: relativePath,
    exists: false,
    safePath: false,
    supportedExtension: false,
    sizeBytes: 0,
    qcStatus: 'FAIL',
    blockers: []
  };

  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes('..')) {
    result.blockers.push('UNSAFE_PATH');
    return result;
  }

  result.safePath = insideVault(vaultDir, relativePath);
  if (!result.safePath) result.blockers.push('OUTSIDE_VAULT');

  const ext = path.extname(relativePath).toLowerCase();
  result.supportedExtension = VIDEO_EXTENSIONS.has(ext);
  if (!result.supportedExtension) result.blockers.push('UNSUPPORTED_VIDEO_EXTENSION');

  const fullPath = path.resolve(vaultDir, relativePath);
  try {
    const stat = fs.statSync(fullPath);
    result.exists = stat.isFile();
    result.sizeBytes = stat.size;
    if (!result.exists) result.blockers.push('NOT_A_FILE');
    if (result.sizeBytes === 0) result.blockers.push('EMPTY_FILE');
  } catch {
    result.blockers.push('MEDIA_NOT_PRESENT');
  }

  if (result.safePath && result.exists && result.supportedExtension && result.sizeBytes > 0) {
    result.qcStatus = 'PASS';
  }
  return result;
}

export function qcManifest({ vaultDir, items = [] }) {
  const checked = items.map(item => ({
    ...item,
    qc: inspectMedia({ vaultDir, relativePath: item.path })
  }));
  return {
    schema: 'yhvh.gospel-tv.content-qc/v1',
    authority: 'IZAKHONO',
    checkedAt: new Date().toISOString(),
    total: checked.length,
    passed: checked.filter(x => x.qc.qcStatus === 'PASS').length,
    failed: checked.filter(x => x.qc.qcStatus !== 'PASS').length,
    items: checked
  };
}

export default { inspectMedia, qcManifest };
