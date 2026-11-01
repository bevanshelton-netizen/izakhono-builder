import fs from 'node:fs';
import path from 'node:path';
import { runNativeBuilder } from './native-builder.mjs';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'autonomy', 'engine-manifest.json'), 'utf8'));

/**
 * Provider-neutral builder boundary.
 * IZAKHONO-native is first. External AI builders such as Hercules remain
 * optional adapters and are only used when explicitly configured.
 */
export async function runBuilderAdapter(task) {
  const native = await runNativeBuilder(task);
  if (native.status !== 'waiting' || process.env.IZAKHONO_BUILDER_PREFER_EXTERNAL !== 'true') {
    return native;
  }

  const endpoint = process.env.IZAKHONO_BUILDER_ADAPTER_URL;
  if (!endpoint) return native;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contract: 'izakhono.builder/v1', task: {
        id: task.id, title: task.title, stage: task.stage,
        action: task.action, evidence: task.evidence ?? []
      }}),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { status: 'failed', reason: `builder-http-${response.status}`, body };
    if (!['completed', 'waiting', 'failed'].includes(body.status)) return { status: 'failed', reason: 'invalid-builder-response' };
    return { ...body, provider: body.provider ?? manifest.adapters?.builder?.[0] ?? 'external-builder' };
  } catch (error) {
    return {
      status: 'failed',
      reason: error?.name === 'AbortError' ? 'builder-timeout' : 'builder-request-failed',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}
