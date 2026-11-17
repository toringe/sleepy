import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPrefs, resolveLastPlayed, preferredSound } from '../js/prefs.js';
import { parseCatalog } from '../js/catalog.js';
import { catalogJson, memoryStorage } from './fixtures.mjs';

const catalog = () => parseCatalog(catalogJson());

test('setLastPlayed records last played and last sound', () => {
  const p = createPrefs(memoryStorage());
  assert.equal(p.getLastPlayed(), null);
  p.setLastPlayed('unwind', 'rain');
  assert.deepEqual(p.getLastPlayed(), { sessionId: 'unwind', soundId: 'rain' });
  assert.equal(p.getLastSound('unwind'), 'rain');
  assert.equal(p.getLastSound('softly'), null);
});

test('resolveLastPlayed finds session and sound', () => {
  const p = createPrefs(memoryStorage());
  p.setLastPlayed('softly', 'waves');
  const r = resolveLastPlayed(catalog(), p);
  assert.equal(r.session.id, 'softly');
  assert.equal(r.sound.id, 'waves');
});

test('resolveLastPlayed returns null for unknown session or sound', () => {
  const p = createPrefs(memoryStorage());
  p.setLastPlayed('gone', 'music');
  assert.equal(resolveLastPlayed(catalog(), p), null);
  p.setLastPlayed('unwind', 'thunder');
  assert.equal(resolveLastPlayed(catalog(), p), null);
});

test('preferredSound falls back to first sound', () => {
  const c = catalog();
  const p = createPrefs(memoryStorage());
  const unwind = c.sessions[1];
  assert.equal(preferredSound(unwind, p).id, 'music');
  p.setLastPlayed('unwind', 'rain');
  assert.equal(preferredSound(unwind, p).id, 'rain');
  p.setLastPlayed('unwind', 'thunder');
  assert.equal(preferredSound(unwind, p).id, 'music');
});

test('prefs survive a throwing storage', () => {
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const p = createPrefs(bad);
  assert.doesNotThrow(() => p.setLastPlayed('unwind', 'rain'));
  assert.equal(p.getLastPlayed(), null);
  assert.equal(p.getLastSound('unwind'), null);
});

test('prefs survive corrupt stored JSON', () => {
  const s = memoryStorage();
  s.setItem('sleepy.lastPlayed', '{not json');
  s.setItem('sleepy.lastSound', '[[[');
  const p = createPrefs(s);
  assert.equal(p.getLastPlayed(), null);
  assert.equal(p.getLastSound('unwind'), null);
});
