import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const initialState = () => ({ version: 1, repositories: [], issues: [], pullRequests: [], runs: [], releases: [] });

export class Store {
  constructor(root) { this.root = root; this.file = path.join(root, 'state.json'); this.queue = Promise.resolve(); }
  async init() { await mkdir(this.root, { recursive: true }); try { await readFile(this.file); } catch { await this.save(initialState()); } return this; }
  async load() { return JSON.parse(await readFile(this.file, 'utf8')); }
  async save(value) { const temp = `${this.file}.tmp`; await writeFile(temp, JSON.stringify(value, null, 2)); await rename(temp, this.file); }
  mutate(fn) { this.queue = this.queue.then(async () => { const state = await this.load(); const result = await fn(state); await this.save(state); return result; }); return this.queue; }
}

export function safeSlug(value) {
  const slug = String(value || '').toLowerCase().trim().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.includes('..')) throw new Error('Invalid repository name.');
  return slug;
}
