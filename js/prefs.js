// What Sleepy remembers on the device: last played session + sound, and last sound per session.
import { findSound } from './catalog.js';

const LAST_PLAYED = 'sleepy.lastPlayed';
const LAST_SOUND = 'sleepy.lastSound';

export function createPrefs(storage = globalThis.localStorage) {
  const read = key => {
    try {
      const v = JSON.parse(storage.getItem(key));
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch { return null; }
  };
  const write = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

  return {
    getLastPlayed() {
      const v = read(LAST_PLAYED);
      return v && typeof v.sessionId === 'string' && typeof v.soundId === 'string'
        ? { sessionId: v.sessionId, soundId: v.soundId } : null;
    },
    setLastPlayed(sessionId, soundId) {
      write(LAST_PLAYED, { sessionId, soundId });
      write(LAST_SOUND, { ...(read(LAST_SOUND) || {}), [sessionId]: soundId });
    },
    getLastSound(sessionId) {
      const v = read(LAST_SOUND)?.[sessionId];
      return typeof v === 'string' ? v : null;
    },
  };
}

export function resolveLastPlayed(c, prefs) {
  const last = prefs.getLastPlayed();
  return last ? findSound(c, last.sessionId, last.soundId) : null;
}

export function preferredSound(session, prefs) {
  const id = prefs.getLastSound(session.id);
  return session.sounds.find(s => s.id === id) || session.sounds[0];
}
