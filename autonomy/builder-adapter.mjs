import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'autonomy', 'engine-manifest.json'), 'utf8'));

/**
 * Builder adapter boundary.
 *
 * The adapter is intentionally provider-neutral. A provider endpoint may be
 * supplied through IZAKHONO_BUILDER_ADAPTER_URL. The endpoint must accept a
 * JSON POST and return { status: 'completed'|'waiting'|'failed', evidence?: [] }.
 *
 * Hercules is one supported builder adapter in the manifest. Its own MCP/OAuth
 * connection is deliberately not embedded here; credentials remain in the
 * provider connection rather than in source control.
 */
export async function runBuilderAdapter(task) {
  const endpoint = process.env.IZAKHONO_BUILDER_ADAPTER_URL;

  if (!endpoint) {
    return {
      status: 'waiting',
      reason: 'builder-connection-required',
      provider: manifest.adapters?.builder?.[0] ?? 'hercules'
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contract: 'izakhono.builder/v1',
        task: {
          id: task.id,
          title: task.title,
          stage: task.stage,
          action: task.action,
          evidence: task.evidence ?? []
        }
      }),
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { status: 'failed', reason: `builder-http-${response.status}`, body };
    }

    if (!['completed', 'waiting', 'failed'].includes(body.status)) {
      return { status: 'failed', reason: 'invalid-builder-response' };
    }

    return body;
  } catch (error) {
    return {
      status: 'failed',
      reason: error?.name === 'AbortError' ? 'builder-timeout' : 'builder-request-failed',
      message: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}
