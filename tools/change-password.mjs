// Changes the password. Only key.enc is rewritten; audio files stay the same.
// Phones that are already unlocked keep working. Usage: node tools/change-password.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { unwrapRawKey, wrapContentKey } from './lib/encrypt.mjs';
import { WrongPasswordError } from '../js/crypto.js';
import { KEY_FILE } from './lib/paths.mjs';
import { askPassword } from './lib/prompt.mjs';

const oldPassword = process.env.SLEEPY_OLD_PASSWORD || await askPassword('Current password: ');
let raw;
try {
  raw = await unwrapRawKey(await readFile(KEY_FILE), oldPassword);
} catch (e) {
  console.error(e instanceof WrongPasswordError ? 'Wrong password.' : e.message);
  process.exit(1);
}
const newPassword = await askPassword('New password: ', { confirm: true });
await writeFile(KEY_FILE, await wrapContentKey(raw, newPassword));
raw.fill(0);
console.log('Password changed. Commit and push key.enc to publish it.');
