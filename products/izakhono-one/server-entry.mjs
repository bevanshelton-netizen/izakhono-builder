import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(dir, 'server.mjs'), 'utf8');
const markers = ["./services/node-control-api.mjs", "server.listen(port,host"];

if (!markers.every(marker => source.includes(marker))) {
  console.error('IZAKHONO_ONE_START_BLOCKED=SERVER_NODE_CONTROL_NOT_INTEGRATED');
  process.exitCode = 78;
} else {
  await import('./server.mjs');
}
