import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function createVirtualFilesystem(root) {
  const base = path.resolve(root);
  const safe = (input = '/') => {
    const relative = String(input).replace(/^\/+/, '');
    const target = path.resolve(base, relative);
    if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('path escapes workspace');
    return target;
  };

  return {
    async init() { await mkdir(base, { recursive: true }); },
    async list(input = '/') {
      const target = safe(input);
      const names = await readdir(target, { withFileTypes: true });
      return names.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
    },
    async read(input) { return readFile(safe(input), 'utf8'); },
    async write(input, content) {
      const target = safe(input);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, String(content), 'utf8');
    },
    async info(input) {
      const result = await stat(safe(input));
      return { size: result.size, directory: result.isDirectory(), modified_at: result.mtime.toISOString() };
    }
  };
}
