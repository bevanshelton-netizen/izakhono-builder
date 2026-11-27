import { hasVerifiedSourceRights, type ProductionAsset } from './cinematic-production-graph';

export interface PrivateSourceObject {
  body: ReadableStream<Uint8Array> | null;
}

export type PrivateSourceReader = (key: string) => Promise<PrivateSourceObject | null>;

export interface ResolvedOriginalSourceImage {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  sha256: string;
  byteSize: number;
  dataUri: string;
}

/**
 * Rehydrates an original source image only when the latest rights decision
 * matches its immutable content hash. Bytes are re-hashed on every read.
 */
export async function resolveOriginalSourceImage(
  projectId: string,
  asset: ProductionAsset,
  readPrivateObject: PrivateSourceReader,
  maxBytes = 12_000_000,
): Promise<ResolvedOriginalSourceImage> {
  if (asset.role !== 'source' || asset.kind !== 'image' || asset.status !== 'completed'
    || !asset.sourceEvidence || !asset.storageKey
    || asset.storageKey !== `projects/${projectId}/source/${asset.id}`
    || !asset.contentHash || !/^[a-f0-9]{64}$/i.test(asset.contentHash)
    || asset.sourceEvidence.sha256.toLowerCase() !== asset.contentHash.toLowerCase()
    || asset.sourceEvidence.mimeType !== asset.mimeType
    || !hasVerifiedSourceRights(asset)) {
    throw new Error('Original source image is not eligible: completed storage, matching provenance and latest verified rights evidence are required.');
  }
  const mimeType = asset.mimeType;
  if (mimeType !== 'image/png' && mimeType !== 'image/jpeg' && mimeType !== 'image/webp') {
    throw new Error('Original source image MIME type is not supported.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new Error('Source image byte limit is invalid.');
  const object = await readPrivateObject(asset.storageKey);
  if (!object?.body) throw new Error('Original source image is missing from private object storage.');
  const bytes = new Uint8Array(await new Response(object.body).arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > maxBytes) throw new Error('Original source image is empty or exceeds the video worker payload limit.');
  if (asset.sourceEvidence.byteSize !== bytes.byteLength) throw new Error('Original source image byte size no longer matches its intake evidence.');
  const signatureMatches = mimeType === 'image/png'
    ? bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    : mimeType === 'image/jpeg'
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  if (!signatureMatches) throw new Error('Original source image bytes no longer match their declared MIME type.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (sha256 !== asset.contentHash.toLowerCase()) throw new Error('Stored original source bytes no longer match their reviewed SHA-256; re-ingest and review the source before use.');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { mimeType, sha256, byteSize: bytes.byteLength, dataUri: `data:${mimeType};base64,${btoa(binary)}` };
}
