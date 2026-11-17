// Checks that every track in catalog.json decrypts with the password and is an MP4/M4A file.
// Usage: node tools/verify.mjs
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unwrapContentKey, decryptAudio } from '../js/crypto.js';
import { parseCatalog, trackFiles, formatClock } from '../js/catalog.js';
import { askPassword } from './lib/prompt.mjs';
import { ROOT, KEY_FILE, readCatalog } from './lib/paths.mjs';

const catalog = parseCatalog(await readCatalog());
let key;
try {
  key = await unwrapContentKey(await readFile(KEY_FILE), await askPassword('Password: '));
} catch (e) { console.error(e.message); process.exit(1); }

const durations = new Map(catalog.sessions.flatMap(s => s.sounds.map(x => [x.file, x.duration])));
let failed = 0;
for (const file of trackFiles(catalog)) {
  try {
    const plain = new Uint8Array(await decryptAudio(await readFile(join(ROOT, file)), key));
    const box = new TextDecoder().decode(plain.subarray(4, 8));
    if (box !== 'ftyp') throw new Error('not an MP4/M4A file');
    console.log(`OK   ${file}  ${formatClock(durations.get(file))}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${file}  ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
