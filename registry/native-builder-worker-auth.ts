/**
 * Native Builder worker credential primitives.
 *
 * Worker identity is resolved exclusively from the stored credential hash.
 * Callers must never supply a trusted worker_id in a request body.
 * Enrollment and credential delivery belong to an administrator-only control path.
 */
export interface WorkerAuthStatement {
  bind(...values: unknown[]): WorkerAuthStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface WorkerAuthDb {
  prepare(sql: string): WorkerAuthStatement;
}

export interface NativeBuilderWorkerIdentity {
  workerId: string;
}

export interface IssuedWorkerCredential {
  workerId: string;
  token: string;
  credentialHash: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

/** Generate a high-entropy bearer credential. Show token once; persist only hash. */
export async function issueNativeBuilderWorkerCredential(
  workerId: string,
): Promise<IssuedWorkerCredential> {
  if (!workerId.trim()) throw new Error("workerId is required");
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = "nbw_" + toHex(bytes);
  return { workerId, token, credentialHash: await sha256Hex(token) };
}

/** Resolve identity from the bearer token; no request-supplied worker ID is trusted. */
export async function authenticateNativeBuilderWorker(
  db: WorkerAuthDb,
  authorization: string | null | undefined,
): Promise<NativeBuilderWorkerIdentity | null> {
  if (!authorization || !/^Bearer\\s+nbw_[0-9a-f]{64}$/i.test(authorization)) return null;
  const token = authorization.replace(/^Bearer\\s+/i, "");
  const credentialHash = await sha256Hex(token);
  const row = await db.prepare(
    "SELECT worker_id FROM native_builder_workers WHERE credential_hash = ?1 AND status = 'active' LIMIT 1",
  ).bind(credentialHash).first<{ worker_id: string }>();
  return row?.worker_id ? { workerId: row.worker_id } : null;
}
