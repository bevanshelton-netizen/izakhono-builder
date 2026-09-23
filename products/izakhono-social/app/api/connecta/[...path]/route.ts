import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'connecta_session';

function engineBase() {
  const raw = process.env.CONNECTA_ENGINE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const base = engineBase();
  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'CONNECTA ENGINE is not configured for this web route.' },
      { status: 503 },
    );
  }

  const { path } = await context.params;
  const pathname = '/' + path.map(encodeURIComponent).join('/');
  const incoming = new URL(request.url);
  const target = new URL(base + pathname);
  target.search = incoming.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  headers.set('accept', request.headers.get('accept') || 'application/json');

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) headers.set('authorization', 'Bearer ' + token);

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'CONNECTA ENGINE is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const upstreamType = upstream.headers.get('content-type') || '';
  const isJson = upstreamType.includes('application/json');
  const authRoute = pathname === '/v1/auth/register' || pathname === '/v1/auth/login';
  const logoutRoute = pathname === '/v1/auth/logout';

  if (isJson) {
    const data = await upstream.json().catch(() => ({ ok: false, error: 'Invalid engine response' })) as Record<string, unknown>;
    const sessionToken = typeof data.token === 'string' ? data.token : null;
    if (sessionToken) delete data.token;

    const response = NextResponse.json(data, { status: upstream.status });
    response.headers.set('cache-control', 'no-store');
    response.headers.set('x-content-type-options', 'nosniff');

    if (authRoute && upstream.ok && sessionToken) {
      response.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    if (logoutRoute) {
      response.cookies.set(SESSION_COOKIE, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
      });
    }
    return response;
  }

  const raw = await upstream.arrayBuffer();
  const response = new NextResponse(raw, { status: upstream.status });
  if (upstreamType) response.headers.set('content-type', upstreamType);
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('x-content-type-options', 'nosniff');
  return response;
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}
