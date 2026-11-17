import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  MAGIC, normalizePassword, unwrapContentKey, decryptAudio,
  WrongPasswordError, CorruptFileError,
} from '../js/crypto.js';
import { generateRawKey, wrapContentKey, unwrapRawKey, encryptAudio } from '../tools/lib/encrypt.mjs';

const plainOf = n => new Uint8Array(randomBytes(n));

test('audio round trip through wrapped key', async () => {
  const raw = generateRawKey();
  const keyFile = await wrapContentKey(raw, 'pw-1');
  const key = await unwrapContentKey(keyFile, 'pw-1');
  const plain = plainOf(100_000);
  const out = new Uint8Array(await decryptAudio(await encryptAudio(plain, raw), key));
  assert.deepEqual(out, plain);
});

test('wrong password throws WrongPasswordError', async () => {
  const keyFile = await wrapContentKey(generateRawKey(), 'right');
  await assert.rejects(unwrapContentKey(keyFile, 'nope'), WrongPasswordError);
  await assert.rejects(unwrapRawKey(keyFile, 'nope'), WrongPasswordError);
});

test('tampered audio throws CorruptFileError', async () => {
  const raw = generateRawKey();
  const key = await unwrapContentKey(await wrapContentKey(raw, 'pw'), 'pw');
  const enc = await encryptAudio(plainOf(1000), raw);
  enc[enc.length - 1] ^= 1;
  await assert.rejects(decryptAudio(enc, key), CorruptFileError);
});

test('bad magic throws CorruptFileError', async () => {
  const raw = generateRawKey();
  const keyFile = await wrapContentKey(raw, 'pw');
  const key = await unwrapContentKey(keyFile, 'pw');
  const enc = await encryptAudio(plainOf(1000), raw);
  enc[0] = 0x58; keyFile[0] = 0x58;
  await assert.rejects(decryptAudio(enc, key), CorruptFileError);
  await assert.rejects(unwrapContentKey(keyFile, 'pw'), CorruptFileError);
});

test('key file layout', async () => {
  const keyFile = await wrapContentKey(generateRawKey(), 'pw');
  assert.equal(keyFile.length, 5 + 16 + 12 + 32 + 16);
  assert.deepEqual(keyFile.subarray(0, 5), MAGIC);
  assert.equal(new TextDecoder().decode(MAGIC), 'SLPY1');
});

test('audio layout', async () => {
  const enc = await encryptAudio(plainOf(1234), generateRawKey());
  assert.equal(enc.length, 1234 + 5 + 12 + 16);
  assert.deepEqual(enc.subarray(0, 5), MAGIC);
});

test('unwrapRawKey returns the original key', async () => {
  const raw = generateRawKey();
  assert.equal(raw.length, 32);
  assert.deepEqual(await unwrapRawKey(await wrapContentKey(raw, 'pw'), 'pw'), raw);
});

test('normalizePassword trims surrounding whitespace', () => {
  assert.equal(normalizePassword('  ab c \n'), 'ab c');
});

test('content key is not extractable', async () => {
  const key = await unwrapContentKey(await wrapContentKey(generateRawKey(), 'pw'), 'pw');
  assert.equal(key.extractable, false);
  assert.deepEqual(key.usages, ['decrypt']);
});

test('accepts ArrayBuffer input', async () => {
  const raw = generateRawKey();
  const keyFile = await wrapContentKey(raw, 'pw');
  const key = await unwrapContentKey(keyFile.slice().buffer, 'pw');
  const plain = plainOf(64);
  const enc = await encryptAudio(plain, raw);
  assert.deepEqual(new Uint8Array(await decryptAudio(enc.slice().buffer, key)), plain);
});
