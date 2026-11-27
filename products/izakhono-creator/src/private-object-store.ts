/**
 * Provider-neutral adapter for private S3-compatible object storage.
 *
 * The injected client is intentionally a narrow port: an AWS SDK, R2 client,
 * MinIO client or owner-operated gateway can implement it without coupling
 * Creator's domain code to a vendor SDK. No ACL/public-read option is exposed.
 */
export interface PrivateObjectClient {
  putObject(input: {
    bucket: string;
    key: string;
    body: Uint8Array;
    contentType: string;
    metadata: Record<string, string>;
    ifNoneMatch: '*';
  }): Promise<{ etag?: string }>;
  getObject(input: { bucket: string; key: string }): Promise<{
    body: Uint8Array;
    contentType?: string;
    metadata?: Record<string, string>;
  } | null>;
  deleteObject(input: { bucket: string; key: string }): Promise<void>;
}

export interface PrivateObjectStore {
  put(key: string, bytes: Uint8Array, metadata: { contentType: string; sha256: string }): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string; sha256: string } | null>;
  delete(key: string): Promise<void>;
}

export interface PrivateObjectStoreOptions {
  bucket: string;
  projectId: string;
  client: PrivateObjectClient;
  sha256(bytes: Uint8Array): Promise<string>;
  maxObjectBytes?: number;
}

function safeSegment(value: string, label: string): string {
  if (!value || value.length > 160 || value === '.' || value === '..' || !/^[A-Za-z0-9._-]+$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function validateKey(key: string, projectId: string): void {
  if (!key || key.length > 900 || key.startsWith('/') || key.includes('\\') ||
      key.split('/').some(part => !part || part === '.' || part === '..') ||
      !key.startsWith(`projects/${projectId}/`)) {
    throw new Error('Object key must be a safe path inside this project namespace.');
  }
}

function validHash(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function createPrivateObjectStore(options: PrivateObjectStoreOptions): PrivateObjectStore {
  const bucket = safeSegment(options.bucket, 'bucket');
  const projectId = safeSegment(options.projectId, 'project identifier');
  const maxBytes = options.maxObjectBytes ?? 1024 * 1024 * 1024;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Maximum object size must be a positive safe integer.');

  return {
    async put(key, bytes, metadata) {
      validateKey(key, projectId);
      if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > maxBytes) {
        throw new Error('Object bytes are empty or exceed the configured size limit.');
      }
      if (!metadata.contentType?.trim() || metadata.contentType.length > 128) throw new Error('A valid content type is required.');
      if (!validHash(metadata.sha256)) throw new Error('A valid SHA-256 digest is required.');
      const actual = await options.sha256(bytes);
      if (actual.toLowerCase() !== metadata.sha256.toLowerCase()) throw new Error('Object bytes do not match the declared SHA-256 digest.');
      // Conditional creation prevents silent replacement of immutable source/export objects.
      // No ACL field is available: privacy is controlled by bucket policy and credentials.
      await options.client.putObject({
        bucket,
        key,
        body: new Uint8Array(bytes),
        contentType: metadata.contentType,
        metadata: { sha256: actual.toLowerCase(), projectid: projectId },
        ifNoneMatch: '*',
      });
    },

    async get(key) {
      validateKey(key, projectId);
      const object = await options.client.getObject({ bucket, key });
      if (!object) return null;
      if (!(object.body instanceof Uint8Array) || object.body.byteLength < 1 || object.body.byteLength > maxBytes) {
        throw new Error('Stored object is empty or exceeds the configured size limit.');
      }
      const recordedHash = object.metadata?.sha256;
      if (!recordedHash || !validHash(recordedHash)) throw new Error('Stored object is missing valid SHA-256 metadata.');
      const actual = await options.sha256(object.body);
      if (actual.toLowerCase() !== recordedHash.toLowerCase()) throw new Error('Stored object failed SHA-256 integrity verification.');
      if (object.metadata?.projectid !== projectId) throw new Error('Stored object project ownership metadata does not match.');
      return { bytes: new Uint8Array(object.body), contentType: object.contentType || 'application/octet-stream', sha256: actual.toLowerCase() };
    },

    async delete(key) {
      validateKey(key, projectId);
      await options.client.deleteObject({ bucket, key });
    },
  };
}
