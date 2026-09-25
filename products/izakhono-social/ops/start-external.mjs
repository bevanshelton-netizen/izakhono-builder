import { spawn } from 'node:child_process';

const ENGINE_PORT = String(process.env.CONNECTA_ENGINE_PORT || '4100');
const ENGINE_URL = process.env.CONNECTA_ENGINE_URL || `http://127.0.0.1:${ENGINE_PORT}`;

function child(command, args, cwd, extraEnv = {}) {
  return spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: 'inherit',
  });
}

function exited(proc) {
  return new Promise((resolve) => proc.once('exit', (code, signal) => resolve({ code, signal })));
}

async function waitForEngine() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(ENGINE_URL + '/health', { signal: AbortSignal.timeout(2500) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true && body?.database === 'ok' && body?.storage === 'ok') return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('CONNECTA ENGINE did not become healthy');
}

const migrator = child('node', ['scripts/migrate.js'], '/app/engine', {
  CONNECTA_ENGINE_PORT: ENGINE_PORT,
});
const migrationResult = await exited(migrator);
if (migrationResult.code !== 0) {
  console.error('CONNECTA migration failed; refusing to start external bundle.');
  process.exit(migrationResult.code || 1);
}

const engine = child('node', ['src/server.js'], '/app/engine', {
  CONNECTA_ENGINE_PORT: ENGINE_PORT,
});

try {
  await waitForEngine();
} catch (error) {
  console.error(error);
  engine.kill('SIGTERM');
  process.exit(1);
}

const web = child('node', ['server.js'], '/app/web', {
  CONNECTA_ENGINE_URL: ENGINE_URL,
});

let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  web.kill(signal);
  engine.kill(signal);
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

const first = await Promise.race([
  exited(engine).then((result) => ({ name: 'engine', ...result })),
  exited(web).then((result) => ({ name: 'web', ...result })),
]);

console.error(`CONNECTA external bundle component exited: ${first.name}`, first);
stop('SIGTERM');
setTimeout(() => stop('SIGKILL'), 3000).unref();
process.exit(first.code || 1);
