// Sleepy encryption format (shared by the app and the owner tools).
//   key.enc : "SLPY1" | salt(16) | iv(12) | AES-GCM(contentKey[32]) + tag(16)
//   audio   : "SLPY1" | iv(12)   | AES-GCM(audio) + tag(16)
// The password (PBKDF2-SHA256) only wraps the content key; the content key encrypts the audio.

export const MAGIC = new TextEncoder().encode('SLPY1');
export const PBKDF2_ITERATIONS = 600000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
export const KEY_BYTES = 32;
const TAG_BYTES = 16;

export class WrongPasswordError extends Error {
  constructor() { super('Wrong password'); this.name = 'WrongPasswordError'; }
}
export class CorruptFileError extends Error {
  constructor(msg = 'File is damaged or not a Sleepy file') { super(msg); this.name = 'CorruptFileError'; }
}

export function normalizePassword(s) {
  return String(s).trim();
}

const bytes = b => (b instanceof Uint8Array ? b : new Uint8Array(b));

function checkMagic(u, minLength) {
  if (u.length < minLength || MAGIC.some((v, i) => u[i] !== v)) throw new CorruptFileError();
}

export async function deriveWrappingKey(password, salt, usages) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    base, { name: 'AES-GCM', length: 256 }, false, usages);
}

/** Decrypts key.enc and returns the raw 32-byte content key. Throws WrongPasswordError / CorruptFileError. */
export async function unwrapKeyBytes(keyFile, password) {
  const u = bytes(keyFile);
  const head = MAGIC.length + SALT_BYTES + IV_BYTES;
  checkMagic(u, head + KEY_BYTES + TAG_BYTES);
  const salt = u.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
  const iv = u.subarray(MAGIC.length + SALT_BYTES, head);
  const wrapping = await deriveWrappingKey(password, salt, ['decrypt']);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, wrapping, u.subarray(head)));
  } catch {
    throw new WrongPasswordError();
  }
}

/** Returns a non-extractable AES-GCM CryptoKey (decrypt only) for the audio files. */
export async function unwrapContentKey(keyFile, password) {
  const raw = await unwrapKeyBytes(keyFile, password);
  try {
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  } finally {
    raw.fill(0);
  }
}

export async function decryptAudio(file, key) {
  const u = bytes(file);
  const head = MAGIC.length + IV_BYTES;
  checkMagic(u, head + TAG_BYTES);
  try {
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(MAGIC.length, head) }, key, u.subarray(head));
  } catch {
    throw new CorruptFileError('Audio file could not be decrypted');
  }
}
