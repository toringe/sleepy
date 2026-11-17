// Full-screen player and the small now-playing bar on the library.
import { formatClock, formatMinutes } from './catalog.js';

const icon = {
  play: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M5 12a7 7 0 1 0 2.05-4.95M5 4v4h4"/><text x="12" y="15.2" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="-apple-system,system-ui,sans-serif" font-weight="600">15</text></svg>',
  fwd: '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4"/><text x="12" y="15.2" font-size="6.5" text-anchor="middle" fill="currentColor" font-family="-apple-system,system-ui,sans-serif" font-weight="600">15</text></svg>',
  down: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 9.5l6 6 6-6"/></svg>',
};

export function mountPlayerView({ layer, nowbar, player, coverUrl, swipeDown, onClose = () => {} }) {
  layer.innerHTML = `
    <div class="player-bg cover"></div>
    <div class="player">
      <button class="close" type="button" aria-label="Close player">${icon.down}</button>
      <div class="art cover"></div>
      <h2 class="title"></h2>
      <p class="sub"></p>
      <div class="bar" role="slider" aria-label="Position" tabindex="0">
        <div class="track"><div class="fill"></div><div class="knob"></div></div>
      </div>
      <div class="times"><span class="el">0:00</span><span class="rem">-0:00</span></div>
      <div class="ctrls">
        <button class="skip" type="button" data-skip="-15" aria-label="Back 15 seconds">${icon.back}</button>
        <button class="pp" type="button" aria-label="Play">${icon.play}</button>
        <button class="skip" type="button" data-skip="15" aria-label="Forward 15 seconds">${icon.fwd}</button>
      </div>
      <p class="done" aria-live="polite"></p>
    </div>`;
  const q = s => layer.querySelector(s);
  const el = { bg: q('.player-bg'), art: q('.art'), title: q('.title'), sub: q('.sub'), bar: q('.bar'), fill: q('.fill'), knob: q('.knob'),
               elapsed: q('.el'), remain: q('.rem'), pp: q('.pp'), done: q('.done') };
  let shownFile = null;
  let dragging = false;

  function close() {
    layer.hidden = true;
    layer.style.transform = '';
    onClose();
    update(player.state());
  }

  function open() {
    layer.hidden = false;
    update(player.state());
  }

  function update(s) {
    // now-playing bar
    const active = !!s.sound && !s.ended;
    nowbar.hidden = !active || !layer.hidden;
    if (active) {
      nowbar.innerHTML = `
        <span class="thumb cover" style="background-image:url('${coverUrl(s.session)}')"></span>
        <span class="info"><b></b><span></span></span>
        <span class="mini-pp" data-mini aria-label="${s.playing ? 'Pause' : 'Play'}">${s.playing ? icon.pause : icon.play}</span>`;
      nowbar.querySelector('b').textContent = s.session.title;
      nowbar.querySelector('.info span').textContent = s.sound.label || formatMinutes(s.sound.duration);
    }
    if (layer.hidden || !s.sound) return;

    if (shownFile !== s.sound.file) {
      shownFile = s.sound.file;
      el.bg.style.backgroundImage = `url('${coverUrl(s.session, 600)}')`;
      el.art.style.backgroundImage = `url('${coverUrl(s.session, 1200)}')`;
      el.title.textContent = s.session.title;
      el.sub.textContent = [s.sound.label, formatMinutes(s.sound.duration)].filter(Boolean).join(' · ');
    }
    if (!dragging) setProgress(s.position, s.duration);
    el.pp.innerHTML = s.playing ? icon.pause : icon.play;
    el.pp.setAttribute('aria-label', s.playing ? 'Pause' : 'Play');
    el.done.textContent = s.error ? "Couldn't play this track" : s.ended ? 'Finished · sleep well' : '';
  }

  function setProgress(pos, dur) {
    const f = dur > 0 ? Math.min(1, pos / dur) : 0;
    el.fill.style.width = `${f * 100}%`;
    el.knob.style.left = `${f * 100}%`;
    el.elapsed.textContent = formatClock(pos);
    el.remain.textContent = '−' + formatClock(Math.max(0, dur - pos));
    el.bar.setAttribute('aria-valuenow', String(Math.round(pos)));
    el.bar.setAttribute('aria-valuemax', String(Math.round(dur)));
  }

  // controls
  el.pp.addEventListener('click', () => player.toggle());
  layer.querySelectorAll('[data-skip]').forEach(b => b.addEventListener('click', () => player.seekBy(Number(b.dataset.skip))));
  q('.close').addEventListener('click', close);
  swipeDown(layer, close);

  // seeking: tap or drag on the bar
  const timeAt = e => {
    const r = el.bar.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    return f * player.state().duration;
  };
  el.bar.addEventListener('pointerdown', e => {
    dragging = true;
    el.bar.setPointerCapture(e.pointerId);
    setProgress(timeAt(e), player.state().duration);
  });
  el.bar.addEventListener('pointermove', e => { if (dragging) setProgress(timeAt(e), player.state().duration); });
  const end = e => { if (!dragging) return; dragging = false; player.seekTo(timeAt(e)); };
  el.bar.addEventListener('pointerup', end);
  el.bar.addEventListener('pointercancel', () => { dragging = false; });
  el.bar.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') player.seekBy(-15);
    if (e.key === 'ArrowRight') player.seekBy(15);
  });

  // now-playing bar: the round button toggles, the rest opens the player
  nowbar.addEventListener('click', e => {
    if (e.target.closest('[data-mini]')) player.toggle();
    else open();
  });

  return { open, close, update };
}
