import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const DRIVER = String(process.env.CONNECTA_STORAGE_DRIVER || 'local').trim().toLowerCase();
const MEDIA_ROOT = path.resolve(process.env.MEDIA_ROOT || '/var/lib/connecta/media');

let s3 = null;
let s3Bucket = '';
let s3Prefix = '';

function bool(value, fallback = false) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function safeLocalPath(objectKey) {
  const normalized = String(objectKey || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) throw new Error('Invalid media object key');
  const full = path.resolve(MEDIA_ROOT, normalized);
  if (!full.startsWith(MEDIA_ROOT + path.sep) && full !== MEDIA_ROOT) {
    throw new Error('Media object path escapes storage root');
  }
  return full;
}

function s3ObjectKey(objectKey) {
  const normalized = String(objectKey || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) throw new Error('Invalid media object key');
  return s3Prefix ? `${s3Prefix}/${normalized}` : normalized;
}

export async function initializeStorage() {
  if (DRIVER === 'local') {
    await mkdir(MEDIA_ROOT, { recursive: true });
    return;
  }
  if (DRIVER !== 's3') {
    throw new Error(`Unsupported CONNECTA_STORAGE_DRIVER: ${DRIVER}`);
  }

  s3Bucket = String(process.env.CONNECTA_S3_BUCKET || '').trim();
  if (!s3Bucket) throw new Error('CONNECTA_S3_BUCKET is required when CONNECTA_STORAGE_DRIVER=s3');

  s3Prefix = String(process.env.CONNECTA_S3_PREFIX || 'connecta-media')
    .trim()
    .replace(/^\/+|\/+$/g, '');

  const accessKeyId = String(process.env.CONNECTA_S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.CONNECTA_S3_SECRET_ACCESS_KEY || '').trim();
  const endpoint = String(process.env.CONNECTA_S3_ENDPOINT || '').trim() || undefined;
  const region = String(process.env.CONNECTA_S3_REGION || 'us-east-1').trim();

  s3 = new S3Client({
    region,
    endpoint,
    forcePathStyle: bool(process.env.CONNECTA_S3_FORCE_PATH_STYLE, Boolean(endpoint)),
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}

export async function putMedia(objectKey, bytes, contentType = 'application/octet-stream') {
  if (DRIVER === 'local') {
    const diskPath = safeLocalPath(objectKey);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, bytes, { mode: 0o600 });
    return;
  }

  await s3.send(new PutObjectCommand({
    Bucket: s3Bucket,
    Key: s3ObjectKey(objectKey),
    Body: bytes,
    ContentType: contentType,
    CacheControl: 'private, max-age=60',
  }));
}

export async function getMedia(objectKey) {
  if (DRIVER === 'local') {
    return readFile(safeLocalPath(objectKey));
  }

  const response = await s3.send(new GetObjectCommand({
    Bucket: s3Bucket,
    Key: s3ObjectKey(objectKey),
  }));
  if (!response.Body) throw new Error('Media object body missing');
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function storageHealth() {
  if (DRIVER === 'local') {
    const probe = safeLocalPath('.connecta-health');
    const marker = Buffer.from(String(Date.now()));
    try {
      await writeFile(probe, marker, { mode: 0o600 });
      const read = await readFile(probe);
      return read.equals(marker);
    } finally {
      await unlink(probe).catch(() => {});
    }
  }

  await s3.send(new HeadBucketCommand({ Bucket: s3Bucket }));
  return true;
}

export function storageInfo() {
  return {
    driver: DRIVER,
    providerIndependent: true,
    externalServiceIsReplaceableAdapter: DRIVER !== 'local',
  };
}
