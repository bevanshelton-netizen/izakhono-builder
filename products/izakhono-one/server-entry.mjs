import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(dir, 'server.mjs'), 'utf8');

const required = [
  "./services/node-control-api.mjs",
  "const host = String(process.env.HOST || '0.0.0.0').trim() || '0.0.0.0';",
  "server.listen(port,host"
];

if (required.every(marker => source.includes(marker))) {
  await import('./server.mjs');
} else {
  // Keep the production entrypoint fail-closed until the checked-in server
  // contains the NODE control boundary and externally bindable host setting.
  console.error('IZAKHONO_ONE_START_BLOCKED=SERVER_NODE_CONTROL_NOT_INTEGRATED');
  process.exitCode = 78;
}
