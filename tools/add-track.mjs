// Encrypts one audio file and adds (or replaces) it in catalog.json.
//
// node tools/add-track.mjs --session unwind --title "Unwind the Day" --group falling-asleep \
//   --sound rain --label Rain --audio "tmp/normalized/Unwind into Sleep with Rain.m4a" \
//   --cover "tmp/covers/Unwind into Sleep.jpg"
//
// --label is shown on the sound switch; leave it out for sessions with only one sound.
// --cover is needed the first time a session is added (writes covers/<session>-600.jpg and -1200.jpg).
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { unwrapRawKey, encryptAudio } from './lib/encrypt.mjs';
import { WrongPasswordError } from '../js/crypto.js';
import { upsertSound } from './lib/catalog-edit.mjs';
import { askPassword } from './lib/prompt.mjs';
import { ROOT, KEY_FILE, readCatalog, writeCatalog } from './lib/paths.mjs';

const { values: a } = parseArgs({ options: {
  session: { type: 'string' }, title: { type: 'string' }, group: { type: 'string' },
  sound: { type: 'string' }, label: { type: 'string' }, audio: { type: 'string' }, cover: { type: 'string' },
} });
const missing = ['session', 'title', 'group', 'sound', 'audio'].filter(k => !a[k]);
if (missing.length) { console.error(`Missing: ${missing.map(k => '--' + k).join(', ')}`); process.exit(1); }
const slug = /^[a-z0-9-]+$/;
if (!slug.test(a.session) || !slug.test(a.sound)) { console.error('--session and --sound must be lowercase letters, digits and dashes.'); process.exit(1); }
if (!existsSync(a.audio)) { console.error(`Audio file not found: ${a.audio}`); process.exit(1); }

const coverBase = join(ROOT, 'covers', a.session);
if (!a.cover && !existsSync(`${coverBase}-600.jpg`)) {
  console.error(`Session "${a.session}" has no cover yet. Add --cover <image>.`); process.exit(1);
}

// Duration from macOS afinfo ("estimated duration: 1769.012245 sec")
const info = execFileSync('afinfo', [a.audio], { encoding: 'utf8' });
const duration = Number(/estimated duration:\s*([\d.]+)/.exec(info)?.[1]);
if (!duration) { console.error('Could not read the audio duration (is it an .m4a file?).'); process.exit(1); }

let raw;
try {
  raw = await unwrapRawKey(await readFile(KEY_FILE), await askPassword('Password: '));
} catch (e) {
  console.error(e instanceof WrongPasswordError ? 'Wrong password.' : e.message); process.exit(1);
}

const enc = await encryptAudio(await readFile(a.audio), raw);
raw.fill(0);
const hash = createHash('sha256').update(enc).digest('hex').slice(0, 8);
const file = `audio/${a.session}-${a.sound}.${hash}.enc`;
await mkdir(join(ROOT, 'audio'), { recursive: true });
await writeFile(join(ROOT, file), enc);

if (a.cover) {
  await mkdir(join(ROOT, 'covers'), { recursive: true });
  for (const size of [600, 1200]) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '-Z', String(size), a.cover, '--out', `${coverBase}-${size}.jpg`], { stdio: 'ignore' });
  }
}

const { catalog, replacedFile } = upsertSound(await readCatalog(), {
  sessionId: a.session, title: a.title, group: a.group, cover: a.session,
  soundId: a.sound, label: a.label ?? null, file, duration: Math.round(duration * 10) / 10, bytes: enc.length,
});
await writeCatalog(catalog);
if (replacedFile && replacedFile !== file) await rm(join(ROOT, replacedFile), { force: true });

console.log(`Added ${a.title}${a.label ? ` (${a.label})` : ''}: ${file}, ${(enc.length / 1e6).toFixed(1)} MB, ${Math.round(duration / 60)} min`);
