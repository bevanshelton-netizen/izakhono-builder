export const dynamic = 'force-dynamic';

export async function GET() {
  const base = process.env.CONNECTA_ENGINE_URL?.trim().replace(/\/$/, '');
  if (!base) {
    return Response.json({
      ok: false,
      service: 'CONNECTA',
      web: 'ok',
      engine: 'not-configured',
      tracking: false,
    }, { status: 503 });
  }

  try {
    const response = await fetch(base + '/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(4_000),
    });
    const engine = await response.json().catch(() => null);
    const healthy = response.ok && engine?.ok === true && engine?.database === 'ok';
    return Response.json({
      ok: healthy,
      service: 'CONNECTA',
      version: '0.2.0',
      web: 'ok',
      engine: healthy ? 'ok' : 'error',
      providerIndependent: engine?.providerIndependent === true,
      behaviouralTracking: false,
    }, { status: healthy ? 200 : 503 });
  } catch {
    return Response.json({
      ok: false,
      service: 'CONNECTA',
      version: '0.2.0',
      web: 'ok',
      engine: 'unreachable',
      behaviouralTracking: false,
    }, { status: 503 });
  }
}
