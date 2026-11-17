// Audio playback + lock-screen (Media Session) integration.
// Blob URLs for stored tracks are prepared ahead of time so play() can run synchronously inside
// the user's tap – iOS refuses to start audio after an async gap.

export function createPlayer({ audio, store, prefs, onChange = () => {} }) {
  const urls = new Map(); // file -> object URL
  const st = { session: null, sound: null, groupTitle: '', playing: false, ended: false, error: null };
  const ms = 'mediaSession' in navigator ? navigator.mediaSession : null;

  const state = () => ({
    ...st,
    position: audio.currentTime || 0,
    duration: Number.isFinite(audio.duration) ? audio.duration : (st.sound?.duration || 0),
  });
  const emit = () => onChange(state());

  async function prepare(files) {
    for (const [file, url] of urls) {
      if (!files.includes(file) && st.sound?.file !== file) { URL.revokeObjectURL(url); urls.delete(file); }
    }
    for (const file of files) {
      if (urls.has(file)) continue;
      const blob = await store.getTrack(file);
      if (blob) urls.set(file, URL.createObjectURL(blob));
    }
  }

  function setMetadata() {
    if (!ms) return;
    const art = size => ({ src: new URL(`covers/${st.session.cover}-${size}.jpg`, location.href).href, sizes: `${size}x${size}`, type: 'image/jpeg' });
    ms.metadata = new MediaMetadata({
      title: st.session.title,
      artist: st.sound.label || 'Sleepy',
      album: st.groupTitle || 'Sleepy',
      artwork: [art(600), art(1200)],
    });
  }

  function start() {
    st.ended = false;
    st.error = null;
    const p = audio.play();
    if (p?.catch) p.catch(e => { st.error = e.message; st.playing = false; emit(); });
  }

  async function play(session, sound, groupTitle = '') {
    const same = st.sound && st.session?.id === session.id && st.sound.id === sound.id;
    if (same && !st.ended) { if (audio.paused) start(); return; }

    audio.pause();
    Object.assign(st, { session, sound, groupTitle, playing: false, ended: false, error: null });
    prefs?.setLastPlayed(session.id, sound.id);
    setMetadata();

    let url = urls.get(sound.file);
    if (url) {
      audio.src = url;
      audio.currentTime = 0;
      start();
    } else {
      emit();
      const blob = await store.getTrack(sound.file);
      if (!blob) { st.error = 'Track not available yet'; emit(); return; }
      url = URL.createObjectURL(blob);
      urls.set(sound.file, url);
      audio.src = url;
      start();
    }
    emit();
  }

  function toggle() {
    if (!st.sound) return;
    if (st.ended) { audio.currentTime = 0; start(); return; }
    if (audio.paused) start(); else audio.pause();
  }

  function seekTo(t) {
    const d = state().duration;
    audio.currentTime = Math.max(0, Math.min(d ? d - 0.25 : t, t));
    if (st.ended && t < d) { st.ended = false; }
    emit();
  }
  const seekBy = s => seekTo((audio.currentTime || 0) + s);

  function stop() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    Object.assign(st, { session: null, sound: null, playing: false, ended: false });
    if (ms) ms.metadata = null;
    emit();
  }

  audio.addEventListener('play', () => { st.playing = true; if (ms) ms.playbackState = 'playing'; emit(); });
  audio.addEventListener('pause', () => { st.playing = false; if (ms) ms.playbackState = 'paused'; emit(); });
  audio.addEventListener('ended', () => { st.playing = false; st.ended = true; if (ms) ms.playbackState = 'paused'; emit(); });
  audio.addEventListener('loadedmetadata', emit);
  audio.addEventListener('timeupdate', () => {
    emit();
    if (ms?.setPositionState && Number.isFinite(audio.duration) && audio.duration > 0) {
      try { ms.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration), playbackRate: 1 }); } catch { /* ignore */ }
    }
  });

  if (ms) {
    const set = (action, fn) => { try { ms.setActionHandler(action, fn); } catch { /* unsupported */ } };
    set('play', () => toggle());
    set('pause', () => audio.pause());
    set('seekbackward', d => seekBy(-(d?.seekOffset || 15)));
    set('seekforward', d => seekBy(d?.seekOffset || 15));
    set('seekto', d => { if (d?.seekTime != null) seekTo(d.seekTime); });
    set('previoustrack', null);
    set('nexttrack', null);
  }

  return { prepare, play, toggle, seekBy, seekTo, stop, state };
}
