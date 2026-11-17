// Sleepy app: boot, unlock, library, sound sheet. Player UI lives in player-view.js.
import { unwrapContentKey, normalizePassword, WrongPasswordError } from './crypto.js';
import { parseCatalog, sessionsByGroup, groupOf, sessionLength, formatMinutes, greeting } from './catalog.js';
import { createPrefs, resolveLastPlayed, preferredSound } from './prefs.js';
import { openStore, requestPersistence } from './store.js';
import { syncTracks } from './sync.js';
import { createPlayer } from './player.js';
import { mountPlayerView } from './player-view.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const coverUrl = (session, size = 600) => `covers/${encodeURIComponent(session.cover)}-${size}.jpg`;
const CATALOG_COPY = 'sleepy.catalog';

const app = {
  store: null,
  key: null,
  catalog: null,
  stored: new Set(),
  prefs: createPrefs(),
  player: null,
  view: null,
  syncing: null,
};

function show(id) {
  for (const s of ['unlock', 'preparing', 'library']) $(s).hidden = s !== id;
}

// ---------- catalog ----------
async function loadCatalog() {
  try {
    const res = await fetch('catalog.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const c = parseCatalog(json);
    try { localStorage.setItem(CATALOG_COPY, JSON.stringify(json)); } catch { /* ignore */ }
    return c;
  } catch (e) {
    try {
      const copy = localStorage.getItem(CATALOG_COPY);
      if (copy) return parseCatalog(JSON.parse(copy));
    } catch { /* fall through */ }
    if (app.catalog) return app.catalog;
    throw e;
  }
}

// ---------- unlock ----------
function setupUnlock() {
  $('unlock-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = normalizePassword($('password').value);
    if (!pw) return;
    $('unlock-btn').disabled = true;
    $('unlock-error').textContent = '';
    try {
      const res = await fetch('key.enc', { cache: 'no-store' });
      if (!res.ok) throw new Error('network');
      const key = await unwrapContentKey(await res.arrayBuffer(), pw);
      await app.store.putKey(key);
      app.key = key;
      $('password').value = '';
      requestPersistence();
      app.catalog = app.catalog || await loadCatalog();
      await firstSync();
    } catch (err) {
      $('unlock-error').textContent = err instanceof WrongPasswordError
        ? "That password didn't work"
        : "Couldn't connect – check your connection and try again";
    } finally {
      $('unlock-btn').disabled = false;
    }
  });
}

// ---------- preparing (first download) ----------
const mb = n => Math.round(n / 1e6);
async function firstSync() {
  show('preparing');
  $('prep-error').textContent = '';
  $('prep-retry').hidden = true;
  try {
    await runSync(({ doneBytes, totalBytes }) => {
      $('prep-bar').style.width = totalBytes ? `${(doneBytes / totalBytes) * 100}%` : '100%';
      $('prep-text').textContent = totalBytes ? `${mb(doneBytes)} / ${mb(totalBytes)} MB` : '';
    });
    renderLibrary();
    show('library');
  } catch {
    $('prep-error').textContent = "Couldn't download – check your connection and try again";
    $('prep-retry').hidden = false;
  }
}

function runSync(onProgress = () => {}) {
  if (!app.syncing) {
    app.syncing = syncTracks({
      catalog: app.catalog, store: app.store, key: app.key, onProgress,
      onTrackStored: file => { app.stored.add(file); renderLibrary(); },
    }).then(async r => {
      for (const f of r.removed) app.stored.delete(f);
      return r;
    }).finally(() => { app.syncing = null; });
  }
  return app.syncing;
}

// ---------- library ----------
const isReady = sound => app.stored.has(sound.file);
const sessionReady = session => session.sounds.some(isReady);

function renderLibrary() {
  if (!app.catalog) return;
  app.player?.prepare([...app.stored]).catch(() => {});
  $('greeting').textContent = greeting(new Date());

  const last = resolveLastPlayed(app.catalog, app.prefs);
  $('hero-slot').innerHTML = last && isReady(last.sound) ? `
    <button class="hero cover shade" data-hero style="background-image:url('${coverUrl(last.session, 1200)}')">
      <small>Last played</small>
      <b>${esc(last.session.title)}</b>
      <span class="meta">${esc(formatMinutes(last.sound.duration))}${last.sound.label ? ' · ' + esc(last.sound.label) : ''}</span>
      <span class="round-play" aria-hidden="true">▶&#xFE0E;</span>
    </button>` : '';

  $('groups').innerHTML = sessionsByGroup(app.catalog).map(({ group, sessions }) => `
    <section class="group">
      <h2>${esc(group.title)}</h2>
      <div class="grid">
        ${sessions.map(s => {
          const ready = sessionReady(s);
          const chips = s.sounds.length > 1
            ? `<div class="chips">${s.sounds.map(x => `<span class="chip">${esc(x.label || x.id)}</span>`).join('')}</div>` : '';
          const prep = ready ? '' : '<div class="chips"><span class="chip">Preparing…</span></div>';
          return `<button class="tile cover shade dim-img${ready ? '' : ' preparing'}" data-session="${esc(s.id)}"
                    ${ready ? '' : 'aria-disabled="true"'} style="background-image:url('${coverUrl(s)}')">
                    <div>${esc(s.title)}<div class="meta">${esc(sessionLength(s))}</div>${chips}${prep}</div>
                  </button>`;
        }).join('')}
      </div>
    </section>`).join('');
}

function setupLibrary() {
  $('library').addEventListener('click', e => {
    if (e.target.closest('[data-hero]')) {
      const last = resolveLastPlayed(app.catalog, app.prefs);
      if (last && isReady(last.sound)) openPlayer(last.session, last.sound);
      return;
    }
    const tile = e.target.closest('[data-session]');
    if (!tile) return;
    const session = app.catalog.sessions.find(s => s.id === tile.dataset.session);
    if (!session || !sessionReady(session)) return;
    if (session.sounds.length === 1) openPlayer(session, session.sounds[0]);
    else openSheet(session);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') $('greeting').textContent = greeting(new Date());
  });
}

// ---------- sound sheet ----------
let sheetSession = null;
let sheetSound = null;

function openSheet(session) {
  sheetSession = session;
  const pref = preferredSound(session, app.prefs);
  sheetSound = isReady(pref) ? pref : session.sounds.find(isReady);
  $('sheet-art').className = 'sheet-art cover';
  $('sheet-art').style.backgroundImage = `url('${coverUrl(session, 1200)}')`;
  $('sheet-title').textContent = session.title;
  $('sheet-desc').textContent = `${groupOf(app.catalog, session).title} · ${sessionLength(session)}`;
  renderSeg();
  $('sheet').hidden = false;
  $('sheet-play').focus({ preventScroll: true });
}

function renderSeg() {
  $('sheet-seg').innerHTML = sheetSession.sounds.map(s => `
    <button type="button" role="radio" data-sound="${esc(s.id)}" aria-checked="${s === sheetSound}" ${isReady(s) ? '' : 'disabled'}>
      ${esc(s.label || s.id)}<small>${isReady(s) ? esc(formatMinutes(s.duration)) : 'Preparing…'}</small>
    </button>`).join('');
}

function closeSheet() {
  $('sheet').hidden = true;
  $('sheet').querySelector('.sheet').style.transform = '';
}

function setupSheet() {
  $('sheet-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-sound]');
    if (!b || b.disabled) return;
    sheetSound = sheetSession.sounds.find(s => s.id === b.dataset.sound);
    renderSeg();
  });
  $('sheet-play').addEventListener('click', () => {
    const session = sheetSession, sound = sheetSound;
    closeSheet();
    if (sound) openPlayer(session, sound);
  });
  $('sheet').addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });
  swipeDown($('sheet').querySelector('.sheet'), closeSheet);
}

/** Drag an element down; past 80 px it calls onClose, otherwise it springs back. */
export function swipeDown(el, onClose) {
  let startY = null, dy = 0;
  el.addEventListener('touchstart', e => {
    if (e.target.closest('.bar, input')) return;
    startY = e.touches[0].clientY; dy = 0; el.style.transition = 'none';
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (startY === null) return;
    el.style.transition = '';
    el.style.transform = '';
    startY = null;
    if (dy > 80) onClose();
  });
}

// ---------- player ----------
function openPlayer(session, sound) {
  app.player.play(session, sound, groupOf(app.catalog, session).title);
  app.view.open();
}

// ---------- boot ----------
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  app.store = await openStore();
  app.player = createPlayer({ audio: $('audio'), store: app.store, prefs: app.prefs, onChange: s => app.view?.update(s) });
  app.view = mountPlayerView({ layer: $('player'), nowbar: $('nowbar'), player: app.player, coverUrl, swipeDown, onClose: renderLibrary });
  setupUnlock();
  setupLibrary();
  setupSheet();
  $('prep-retry').addEventListener('click', async () => {
    if (!app.catalog) {
      try { app.catalog = await loadCatalog(); } catch { return; }
    }
    firstSync();
  });

  app.key = await app.store.getKey();
  if (!app.key) {
    show('unlock');
    loadCatalog().then(c => { app.catalog = c; }).catch(() => {});
    return;
  }
  app.stored = new Set(await app.store.listTracks());
  try {
    app.catalog = await loadCatalog();
  } catch {
    show('preparing');
    $('prep-error').textContent = "Couldn't load your sessions – connect to the internet once and try again";
    $('prep-retry').hidden = false;
    return;
  }
  if (app.stored.size === 0) { firstSync(); return; }
  renderLibrary();
  show('library');
  runSync().catch(() => { /* offline or interrupted: try again next launch */ });
}

boot();
