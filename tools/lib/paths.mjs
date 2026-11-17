import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const KEY_FILE = join(ROOT, 'key.enc');
export const CATALOG_FILE = join(ROOT, 'catalog.json');

export async function readCatalog() {
  return JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
}

export async function writeCatalog(catalog) {
  await writeFile(CATALOG_FILE, JSON.stringify(catalog, null, 2) + '\n');
}
