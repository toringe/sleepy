// Brings the device in line with the catalog: delete removed tracks, download + decrypt missing ones.
import { decryptAudio } from './crypto.js';
import { trackFiles, planSync } from './catalog.js';

async function fetchBytes(fetchFn, file, onBytes) {
  const res = await fetchFn(file, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${file}`);
  if (!res.body?.getReader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.length);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

export async function syncTracks({ catalog, store, key, fetchFn = fetch, onProgress = () => {}, onTrackStored = () => {} }) {
  const plan = planSync(trackFiles(catalog), await store.listTracks());
  for (const file of plan.remove) await store.deleteTrack(file);

  const sizes = new Map(catalog.sessions.flatMap(s => s.sounds.map(x => [x.file, x.bytes || 0])));
  const totalBytes = plan.download.reduce((n, f) => n + sizes.get(f), 0);
  let doneBytes = 0;
  onProgress({ doneBytes, totalBytes, file: plan.download[0] ?? null });

  const downloaded = [];
  for (const file of plan.download) {
    const start = doneBytes;
    const enc = await fetchBytes(fetchFn, file, n => {
      doneBytes = Math.min(doneBytes + n, start + sizes.get(file));
      onProgress({ doneBytes, totalBytes, file });
    });
    const plain = await decryptAudio(enc, key);
    await store.putTrack(file, new Blob([plain], { type: 'audio/mp4' }));
    doneBytes = start + sizes.get(file);
    onProgress({ doneBytes, totalBytes, file });
    downloaded.push(file);
    onTrackStored(file);
  }
  return { downloaded, removed: plan.remove };
}
