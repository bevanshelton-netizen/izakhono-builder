import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase().slice(0, 320) : '';
}

export function normalizeHandle(value) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/^@/, '').slice(0, 40)
    : '';
}

export function validHandle(value) {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value);
}

export function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 12) {
    return 'Password must be at least 12 characters.';
  }
  if (value.length > 256) return 'Password is too long.';
  return '';
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return {
    salt: salt.toString('base64'),
    hash: Buffer.from(derived).toString('base64'),
  };
}

export async function verifyPassword(password, saltB64, hashB64) {
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const derived = Buffer.from(await scrypt(password, salt, expected.length));
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export function newSessionToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function bearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function safeEqualText(a, b) {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  return left.length === right.length && timingSafeEqual(left, right);
}
