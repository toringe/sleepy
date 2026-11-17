import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { syncTracks } from '../js/sync.js';
import { parseCatalog } from '../js/catalog.js';
import { unwrapContentKey } from '../js/crypto.js';
import { generateRawKey, wrapContentKey, encryptAudio } from '../tools/lib/encrypt.mjs';
import { catalogJson } from './fixtures.mjs';

function fakeStore(initial = {}) {
  const tracks = new Map(Object.entries(initial));
  return {
    tracks,
    listTracks: async () => [...tracks.keys()],
    putTrack: async (f, blob) => { tracks.set(f, blob); },
    deleteTrack: async f => { tracks.delete(f); },
  };
}

async function setup() {
  const raw = generateRawKey();
  const key = await unwrapContentKey(await wrapContentKey(raw, 'pw'), 'pw');
  const json = catalogJson();
  const files = {};
  for (const s of json.sessions) for (const snd of s.sounds) {
    const plain = new Uint8Array(randomBytes(snd.bytes));
    const enc = await encryptAudio(plain, raw);
    snd.bytes = enc.length;
    files[snd.file] = { plain, enc };
  }
  const calls = [];
  const fetchFn = async url => { calls.push(url); return new Response(files[url].enc); };
  return { key, catalog: parseCatalog(json), files, calls, fetchFn };
}

test('sync downloads missing tracks and removes stale ones', async () => {
  const { key, catalog, files, fetchFn } = await setup();
  const store = fakeStore({ 'audio/old.enc': new Blob(['x']) });
  const r = await syncTracks({ catalog, store, key, fetchFn });
  assert.equal(r.downloaded.length, 5);
  assert.deepEqual(r.removed, ['audio/old.enc']);
  assert.deepEqual([...store.tracks.keys()].sort(), Object.keys(files).sort());
  const blob = store.tracks.get('audio/unwind-rain.aaaa0003.enc');
  assert.equal(blob.type, 'audio/mp4');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), files['audio/unwind-rain.aaaa0003.enc'].plain);
});

test('sync skips tracks already stored', async () => {
  const { key, catalog, calls, fetchFn } = await setup();
  const store = fakeStore({ 'audio/journey-voice.aaaa0001.enc': new Blob(['already']) });
  const r = await syncTracks({ catalog, store, key, fetchFn });
  assert.ok(!calls.includes('audio/journey-voice.aaaa0001.enc'));
  assert.equal(r.downloaded.length, 4);
});

test('sync keeps completed tracks and stores nothing for a failed one', async () => {
  const { key, catalog, fetchFn } = await setup();
  const store = fakeStore();
  let n = 0;
  const flaky = async url => { if (++n === 2) throw new TypeError('network down'); return fetchFn(url); };
  await assert.rejects(syncTracks({ catalog, store, key, fetchFn: flaky }), /network down/);
  assert.deepEqual([...store.tracks.keys()], ['audio/journey-voice.aaaa0001.enc']);
});

test('sync rejects on a non-ok response and stores nothing for it', async () => {
  const { key, catalog } = await setup();
  const store = fakeStore();
  await assert.rejects(syncTracks({ catalog, store, key, fetchFn: async () => new Response('no', { status: 404 }) }), /404/);
  assert.equal(store.tracks.size, 0);
});

test('progress reaches totalBytes', async () => {
  const { key, catalog, fetchFn } = await setup();
  const store = fakeStore({ 'audio/journey-voice.aaaa0001.enc': new Blob(['x']) });
  const events = [];
  await syncTracks({ catalog, store, key, fetchFn, onProgress: e => events.push(e) });
  const expected = catalog.sessions.flatMap(s => s.sounds).filter(s => s.id !== 'voice').reduce((n, s) => n + s.bytes, 0);
  const last = events.at(-1);
  assert.equal(last.totalBytes, expected);
  assert.equal(last.doneBytes, expected);
  assert.ok(events.every((e, i) => i === 0 || e.doneBytes >= events[i - 1].doneBytes));
});

test('onTrackStored fires once per stored track, after it is stored', async () => {
  const { key, catalog, fetchFn } = await setup();
  const store = fakeStore();
  const seen = [];
  await syncTracks({ catalog, store, key, fetchFn, onTrackStored: f => seen.push([f, store.tracks.has(f)]) });
  assert.equal(seen.length, 5);
  assert.ok(seen.every(([, stored]) => stored));
});
