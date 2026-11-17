// Shared test catalog following the schema in the plan.
export const catalogJson = () => ({
  groups: [
    { id: 'falling-asleep', title: 'Falling asleep' },
    { id: 'back-to-sleep', title: 'Back to sleep' },
  ],
  sessions: [
    { id: 'journey', title: 'Journey into Sleep', group: 'falling-asleep', cover: 'journey',
      sounds: [{ id: 'voice', label: null, file: 'audio/journey-voice.aaaa0001.enc', duration: 1806, bytes: 300 }] },
    { id: 'unwind', title: 'Unwind into Sleep', group: 'falling-asleep', cover: 'unwind',
      sounds: [
        { id: 'music', label: 'Music', file: 'audio/unwind-music.aaaa0002.enc', duration: 1769, bytes: 200 },
        { id: 'rain', label: 'Rain', file: 'audio/unwind-rain.aaaa0003.enc', duration: 1771, bytes: 100 },
      ] },
    { id: 'softly', title: 'Softly Back to Sleep', group: 'back-to-sleep', cover: 'softly',
      sounds: [
        { id: 'music', label: 'Music', file: 'audio/softly-music.aaaa0004.enc', duration: 2180.5, bytes: 400 },
        { id: 'waves', label: 'Waves', file: 'audio/softly-waves.aaaa0005.enc', duration: 2129.9, bytes: 500 },
      ] },
  ],
});

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}
