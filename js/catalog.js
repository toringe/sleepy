// Catalog parsing, grouping, sync planning and display formatting (pure, no DOM).

export function parseCatalog(json) {
  if (!json || !Array.isArray(json.groups)) throw new Error('catalog: "groups" missing');
  if (!Array.isArray(json.sessions)) throw new Error('catalog: "sessions" missing');
  const groupIds = new Set(json.groups.map(g => g.id));
  for (const s of json.sessions) {
    if (!groupIds.has(s.group)) throw new Error(`catalog: session "${s.id}" has unknown group "${s.group}"`);
    if (!Array.isArray(s.sounds) || s.sounds.length === 0) throw new Error(`catalog: session "${s.id}" has no sounds`);
    for (const snd of s.sounds) {
      if (!snd.id || !snd.file) throw new Error(`catalog: session "${s.id}" has a sound without id/file`);
    }
  }
  return json;
}

export function sessionsByGroup(c) {
  return c.groups
    .map(group => ({ group, sessions: c.sessions.filter(s => s.group === group.id) }))
    .filter(g => g.sessions.length > 0);
}

export function groupOf(c, session) {
  return c.groups.find(g => g.id === session.group);
}

export function findSound(c, sessionId, soundId) {
  const session = c.sessions.find(s => s.id === sessionId);
  const sound = session?.sounds.find(s => s.id === soundId);
  return session && sound ? { session, sound } : null;
}

export function trackFiles(c) {
  return c.sessions.flatMap(s => s.sounds.map(snd => snd.file));
}

export function planSync(catalogFiles, storedFiles) {
  const stored = new Set(storedFiles);
  const wanted = new Set(catalogFiles);
  return {
    download: catalogFiles.filter(f => !stored.has(f)),
    remove: storedFiles.filter(f => !wanted.has(f)),
  };
}

export function formatMinutes(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

export function formatClock(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

export function sessionLength(session) {
  const d = session.sounds.map(s => s.duration);
  const mean = d.reduce((n, x) => n + x, 0) / d.length;
  const spread = Math.max(...d) - Math.min(...d);
  return spread >= 30 ? `about ${formatMinutes(mean)}` : formatMinutes(mean);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  if (h >= 18 && h < 22) return 'Good evening';
  return 'Good night';
}
