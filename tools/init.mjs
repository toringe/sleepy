// One-time setup: creates key.enc (content key wrapped with your password) and an empty catalog.json.
// Usage: node tools/init.mjs
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { generateRawKey, wrapContentKey } from './lib/encrypt.mjs';
import { askPassword } from './lib/prompt.mjs';
import { emptyCatalog } from './lib/catalog-edit.mjs';
import { KEY_FILE, CATALOG_FILE, writeCatalog } from './lib/paths.mjs';

if (existsSync(KEY_FILE)) {
  console.error('key.enc already exists. Use tools/change-password.mjs to change the password.');
  process.exit(1);
}
const password = await askPassword('New password: ', { confirm: true });
const raw = generateRawKey();
await writeFile(KEY_FILE, await wrapContentKey(raw, password));
raw.fill(0);
const newCatalog = !existsSync(CATALOG_FILE);
if (newCatalog) await writeCatalog(emptyCatalog());
console.log('Created key.enc' + (newCatalog ? ' and catalog.json' : ''));
