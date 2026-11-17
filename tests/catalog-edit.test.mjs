import { test } from 'node:test';
import assert from 'node:assert/strict';
import { upsertSound, emptyCatalog } from '../tools/lib/catalog-edit.mjs';
import { parseCatalog } from '../js/catalog.js';

const entry = (o = {}) => ({
  sessionId: 'unwind', title: 'Unwind into Sleep', group: 'falling-asleep', cover: 'unwind',
  soundId: 'music', label: 'Music', file: 'audio/unwind-music.11111111.enc', duration: 1769, bytes: 10, ...o,
});

test('emptyCatalog has the two groups and parses', () => {
  const c = emptyCatalog();
  assert.deepEqual(c.groups.map(g => g.title), ['Falling asleep', 'Back to sleep']);
  assert.deepEqual(c.sessions, []);
  parseCatalog(c);
});

test('creates a new session in the given group', () => {
  const { catalog, replacedFile } = upsertSound(emptyCatalog(), entry());
  assert.equal(replacedFile, null);
  assert.equal(catalog.sessions.length, 1);
  assert.deepEqual(catalog.sessions[0], {
    id: 'unwind', title: 'Unwind into Sleep', group: 'falling-asleep', cover: 'unwind',
    sounds: [{ id: 'music', label: 'Music', file: 'audio/unwind-music.11111111.enc', duration: 1769, bytes: 10 }],
  });
  parseCatalog(catalog);
});

test('adds a second sound to an existing session keeping order', () => {
  let { catalog } = upsertSound(emptyCatalog(), entry());
  ({ catalog } = upsertSound(catalog, entry({ soundId: 'rain', label: 'Rain', file: 'audio/unwind-rain.2.enc' })));
  assert.deepEqual(catalog.sessions[0].sounds.map(s => s.id), ['music', 'rain']);
});

test('replaces an existing sound and returns its old file', () => {
  let { catalog } = upsertSound(emptyCatalog(), entry());
  const r = upsertSound(catalog, entry({ file: 'audio/unwind-music.22222222.enc', duration: 1770 }));
  assert.equal(r.replacedFile, 'audio/unwind-music.11111111.enc');
  assert.equal(r.catalog.sessions[0].sounds.length, 1);
  assert.equal(r.catalog.sessions[0].sounds[0].file, 'audio/unwind-music.22222222.enc');
});

test('updates session title, group and cover when given', () => {
  let { catalog } = upsertSound(emptyCatalog(), entry());
  ({ catalog } = upsertSound(catalog, entry({ soundId: 'rain', title: 'Unwind', group: 'back-to-sleep' })));
  assert.equal(catalog.sessions[0].title, 'Unwind');
  assert.equal(catalog.sessions[0].group, 'back-to-sleep');
});

test('throws on unknown group', () => {
  assert.throws(() => upsertSound(emptyCatalog(), entry({ group: 'naps' })), /group/);
});

test('does not mutate the input catalog', () => {
  const c = emptyCatalog();
  upsertSound(c, entry());
  assert.equal(c.sessions.length, 0);
});
