// Owner-side encryption (Node). Format: see js/crypto.js.
import { MAGIC, SALT_BYTES, IV_BYTES, KEY_BYTES, deriveWrappingKey, unwrapKeyBytes } from '../../js/crypto.js';

export function generateRawKey() {
  return crypto.getRandomValues(new Uint8Array(KEY_BYTES));
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export async function wrapContentKey(rawKey, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrapping = await deriveWrappingKey(password, salt, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapping, rawKey));
  return concat(MAGIC, salt, iv, ct);
}

export const unwrapRawKey = unwrapKeyBytes;

export async function encryptAudio(plain, rawKey) {
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return concat(MAGIC, iv, ct);
}
