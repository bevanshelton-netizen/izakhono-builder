import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { MediaExportRuntime } from './media-export-executor';

/** Node/container implementation for the provider-neutral media export runtime. */
export function createNodeMediaExportRuntime(options: { timeoutMs?: number; maxOutputBytes?: number } = {}): MediaExportRuntime {
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000;
  const maxOutputBytes = options.maxOutputBytes ?? 8 * 1024 * 1024;
  return {
    run(command, args) {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          finish(new Error(`${command} exceeded the ${timeoutMs}ms execution limit.`));
        }, timeoutMs);
        const finish = (error?: Error | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (error) reject(error);
          else resolve({ stdout, stderr });
        };
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => {
          stdout += chunk;
          if (Buffer.byteLength(stdout) > maxOutputBytes) {
            child.kill('SIGKILL');
            finish(new Error(`${command} stdout exceeded the configured output limit.`));
          }
        });
        child.stderr.on('data', chunk => {
          stderr += chunk;
          if (Buffer.byteLength(stderr) > maxOutputBytes) {
            child.kill('SIGKILL');
            finish(new Error(`${command} stderr exceeded the configured output limit.`));
          }
        });
        child.on('error', error => finish(error));
        child.on('close', code => {
          if (code !== 0) finish(new Error(`${command} exited with code ${String(code)}: ${stderr.slice(-4000)}`));
          else finish();
        });
      });
    },
    async readFile(path) {
      return new Uint8Array(await readFile(path));
    },
    async writeFile(path, bytes) {
      await writeFile(path, bytes, { flag: 'wx' });
    },
    async sha256(bytes) {
      return createHash('sha256').update(bytes).digest('hex');
    },
  };
}
