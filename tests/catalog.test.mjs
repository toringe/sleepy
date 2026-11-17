import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCatalog, sessionsByGroup, findSound, trackFiles, planSync,
  formatMinutes, formatClock, sessionLength, greeting,
} from '../js/catalog.js';
import { catalogJson } from './fixtures.mjs';

test('sessionsByGroup keeps group order and drops empty groups', () => {
  const json = catalogJson();
  json.groups.unshift({ id: 'empty', title: 'Empty' });
  const c = parseCatalog(json);
  const g = sessionsByGroup(c);
  assert.deepEqual(g.map(x => x.group.id), ['falling-asleep', 'back-to-sleep']);
  assert.deepEqual(g[0].sessions.map(s => s.id), ['journey', 'unwind']);
});

test('parseCatalog rejects a session with an unknown group', () => {
  const json = catalogJson();
  json.sessions[0].group = 'nope';
  assert.throws(() => parseCatalog(json), /group/);
});

test('parseCatalog rejects missing sessions and sessions without sounds', () => {
  assert.throws(() => parseCatalog({ groups: [] }), /sessions/);
  const json = catalogJson();
  json.sessions[1].sounds = [];
  assert.throws(() => parseCatalog(json), /sounds/);
});

test('findSound and trackFiles', () => {
  const c = parseCatalog(catalogJson());
  assert.equal(findSound(c, 'unwind', 'rain').sound.label, 'Rain');
  assert.equal(findSound(c, 'unwind', 'nope'), null);
  assert.equal(findSound(c, 'nope', 'rain'), null);
  assert.equal(trackFiles(c).length, 5);
  assert.equal(trackFiles(c)[0], 'audio/journey-voice.aaaa0001.enc');
});

test('planSync downloads files missing from store and removes files not in catalog', () => {
  assert.deepEqual(planSync(['a', 'b', 'c'], ['b', 'x']), { download: ['a', 'c'], remove: ['x'] });
});

test('formatClock', () => {
  assert.equal(formatClock(504), '8:24');
  assert.equal(formatClock(3723), '1:02:03');
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(NaN), '0:00');
});

test('formatMinutes rounds', () => {
  assert.equal(formatMinutes(1806), '30 min');
  assert.equal(formatMinutes(1565), '26 min');
});

test('sessionLength says "about" when sounds differ', () => {
  const c = parseCatalog(catalogJson());
  assert.equal(sessionLength(c.sessions[1]), '30 min');       // 1769 & 1771
  assert.equal(sessionLength(c.sessions[2]), 'about 36 min'); // 2180.5 & 2129.9 (real data: 36 vs 35 min)
  assert.equal(sessionLength(c.sessions[0]), '30 min');
});

test('greeting boundaries', () => {
  const at = (h, m) => new Date(2026, 10, 17, h, m);
  assert.equal(greeting(at(4, 59)), 'Good night');
  assert.equal(greeting(at(5, 0)), 'Good morning');
  assert.equal(greeting(at(12, 0)), 'Good afternoon');
  assert.equal(greeting(at(18, 0)), 'Good evening');
  assert.equal(greeting(at(21, 59)), 'Good evening');
  assert.equal(greeting(at(22, 0)), 'Good night');
});
