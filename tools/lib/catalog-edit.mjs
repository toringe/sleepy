// Pure catalog editing for the owner tools.

export function emptyCatalog() {
  return {
    groups: [
      { id: 'falling-asleep', title: 'Falling asleep' },
      { id: 'back-to-sleep', title: 'Back to sleep' },
    ],
    sessions: [],
  };
}

/** Adds or replaces one sound. Returns a new catalog and the file of a replaced sound (or null). */
export function upsertSound(catalog, { sessionId, title, group, cover, soundId, label, file, duration, bytes }) {
  if (!catalog.groups.some(g => g.id === group)) {
    throw new Error(`Unknown group "${group}". Known groups: ${catalog.groups.map(g => g.id).join(', ')}`);
  }
  const next = structuredClone(catalog);
  let session = next.sessions.find(s => s.id === sessionId);
  if (!session) {
    session = { id: sessionId, title, group, cover, sounds: [] };
    next.sessions.push(session);
  } else {
    Object.assign(session, { title, group, cover });
  }
  const sound = { id: soundId, label: label ?? null, file, duration, bytes };
  const i = session.sounds.findIndex(s => s.id === soundId);
  let replacedFile = null;
  if (i >= 0) {
    replacedFile = session.sounds[i].file;
    session.sounds[i] = sound;
  } else {
    session.sounds.push(sound);
  }
  return { catalog: next, replacedFile };
}
