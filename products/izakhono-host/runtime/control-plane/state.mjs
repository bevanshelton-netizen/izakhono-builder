import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_FILE = process.env.STATE_FILE || '/state/runtime.json';
const empty = { version: 1, nodes: {}, deployments: {}, revisions: {}, routes: {} };

export async function loadState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch { await saveState(structuredClone(empty)); return structuredClone(empty); }
}

export async function saveState(state) {
  await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
  const tmp = STATE_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(state, null, 2));
  await fs.rename(tmp, STATE_FILE);
}

export async function mutate(fn) {
  const state = await loadState();
  const result = await fn(state);
  await saveState(state);
  return result;
}
