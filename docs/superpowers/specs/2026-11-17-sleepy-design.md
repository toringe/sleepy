# Sleepy – design

*2026-11-17 · status: approved by owner (titles and covers stay public; only audio is encrypted)*

## Intent

A personal sleep-audio app for iPhone and Android. The owner (main user) and a few family members open it in bed, tap a session, lock the phone and fall asleep. When the track ends, nothing more should happen. It must work fully offline, cost nothing to run, and look like a polished, professional meditation app.

## Goals

- Play the owner's sleep sessions on current iOS and Android, offline after first setup.
- Keep playing with the screen locked; pause/resume from the lock screen.
- One tap on a normal night (the "Last played" card).
- Audio is never published in readable form: only someone with the shared password can listen.
- Zero running cost. Free hosting only.
- Adding a new track later is one command plus a push.

## Non-goals

- User accounts, per-person access, or revoking individual users.
- Remembering the playback position across sessions (only pause/resume while it is playing).
- Sleep timer, playlists, autoplay of the next track, looping.
- App Store / Play Store distribution.
- Analytics, notifications, social features.

## Anti-goals (would make it a failure even if it "works")

- Anything bright, flashing or attention-grabbing at bedtime (white screens, popups, sounds on start).
- Unencrypted audio ever reaching the public repository or website.
- Requiring a paid service or a developer account.
- In-app clutter: install instructions, settings screens, explanations. These go in the README.

## Constraints

- iOS without a paid Apple developer account: native apps expire after 7 days, so the app is a **PWA** (installed via Safari → Add to Home Screen; Chrome → Install app on Android).
- Hosting: **GitHub Pages** on a public repo `toringe/sleepy` (free Pages needs a public repo). Pages limits: 1 GB site, 100 MB per file. Current audio is ~270 MB, largest file 53 MB.
- Verified by the spike on the owner's iPhone (iOS 18.7, home-screen app): audio decrypted on-device and stored in IndexedDB plays from a blob URL; keeps playing when locked; lock-screen pause/resume works; app opens and plays in airplane mode; persistent storage is granted.

## Approaches considered

**Platform**
1. **PWA (chosen).** Free, one codebase, installs on both platforms, offline via service worker + on-device storage.
2. Native / Flutter / React Native with free signing – iOS install expires every 7 days. Rejected.
3. App Store / TestFlight – $99/year. Rejected (zero budget).

**Protecting the audio**
1. **Client-side encryption (chosen, "option A").** Audio encrypted with AES-256-GCM before publishing; the app asks for the password once, decrypts on the phone, stores the result locally. Simple, free, works on static hosting. Trade-off: one shared password, no per-user revoke.
2. Cloudflare R2 + Worker / Access login. Real per-user logins, but more setup, more moving parts and flaky login redirects inside iOS home-screen apps. Rejected for now.
3. Password screen in the page only. Gives no real protection (files still downloadable). Rejected.

**Choosing a sound for multi-version sessions**
- **X – sheet before playing (chosen):** tap tile → sheet with cover, description, Music/Rain switch, Play.
- Y – play immediately, switch on the player. Rejected: too easy to start the wrong version unnoticed.

**Visual direction:** **B "Dusk" (chosen)** over A "Night sky" and C "Minimal moon", using the owner's own cover photos.

## What the owner decided

- PWA, GitHub Pages, encrypted audio with one shared password.
- Main use: open in bed → play → lock phone → nothing to do when it ends. Pause available. No saved positions.
- Look: "Dusk" style – purple/indigo gradients, photo tiles, white pill buttons – like a professional meditation app. The approved mockup (`.superpowers/brainstorm/…/dusk-covers-v2.html`) is the reference.
- Sessions with several sounds appear **once**; the sound is chosen in a sheet before playing (X).
- Groups: **Falling asleep** and **Back to sleep**.
- **"Last played" card** on top of the list, with its own play button (same session + sound).
- Cover images from `tmp/covers/`, one per session.
- Install instructions live in the README, not in the app.
- Users: the owner plus possibly family; the owner helps them install.

## Content

| Group | Session | Sounds (file in `tmp/normalized/`) | Cover |
|---|---|---|---|
| Falling asleep | Journey into Sleep | – (Journey into Sleep) 30:06 | Journey into Sleep.jpg |
| Falling asleep | Soften into Sleep | Music (Soften into Sleep with Music) 26:05 | Soften into Sleep.jpg |
| Falling asleep | Unwind into Sleep | Music 29:29 · Rain 29:31 | Unwind into Sleep.jpg |
| Back to sleep | Softly Back to Sleep | Music 36:20 · Waves 35:30 | Softly Back to Sleep.jpg |

Audio source: the −20 LUFS versions in `tmp/normalized/` (AAC 192 kbps, faststart). A session with one sound shows no sound label and skips the sheet.

## The app

**Screens**
1. **Unlock** (first run only): app name, password field, "Unlock". Then a calm progress view ("Preparing your sleep sessions… 120 / 270 MB"). Wrong password → gentle inline message. Interrupted download resumes per track next time.
2. **Library**: time-based greeting ("Good evening" / "Good night" / "Good morning"), "Sleepy" title, *Last played* hero card (hidden until something has been played), then the two groups as 2-column photo tiles with duration and sound chips.
3. **Sound sheet**: bottom sheet with cover, title, group · approx length, segmented sound switch (last choice preselected), Play.
4. **Player**: large cover on a blurred, darkened copy of the cover; title, sound · length, progress bar with elapsed / remaining, ±15 s, play/pause. Chevron / swipe down returns to the library.

**Behaviour**
- Playback continues when locked. Media Session shows title, sound and cover on the lock screen with play/pause and ±15 s.
- At track end: stop. Player shows the track as finished; nothing else plays.
- Starting another session stops the current one.
- Remembered on the device: last played session + sound (for the hero card) and last chosen sound per session. Nothing else.
- Always dark. Photos are slightly dimmed; the player background is heavily darkened.

## Security and storage

- **Two-level keys.** A random 256-bit *content key* encrypts every audio file. The password (PBKDF2-SHA256, 600 000 iterations, random salt) encrypts only the content key, stored as `key.enc`. Changing the password re-encrypts `key.enc` only – audio files and git history stay untouched.
- **File format:** `SLPY1` magic · 12-byte IV · AES-256-GCM ciphertext + tag. `key.enc` additionally holds its salt.
- **On the phone:** after unlock the content key is stored in IndexedDB as a non-extractable CryptoKey, so newly added tracks download and decrypt automatically later without re-entering the password. Decrypted audio blobs are stored in IndexedDB. The app requests persistent storage.
- **Public in the repo:** the app code, `catalog.json` (titles, groups, durations), cover images (resized), and encrypted audio. Session titles and covers are therefore visible to anyone who finds the site; only the audio is protected.
- The password is never stored in the repo or the app. Unencrypted audio is git-ignored (`*.m4a`, `*.mp4`, `tmp/`).

## Offline and updates

- A service worker caches the app shell, catalog and covers (versioned cache). Audio is not in the service-worker cache; it lives in IndexedDB.
- On open while online, the app fetches the catalog; tracks in the catalog but missing on the device are downloaded and decrypted in the background with the stored key. Removed tracks are deleted from the device.
- App updates: new service-worker version activates on the next launch.

## Owner tooling (Node, no dependencies, macOS)

- `tools/init` – generate content key, ask for password, write `key.enc`.
- `tools/add-track` – ask for the password, encrypt an `.m4a` with the content key, resize the cover (`sips`), add/update the entry in `catalog.json`.
- `tools/change-password` – re-encrypt `key.enc` with a new password.
- README: what Sleepy is, installing on iPhone and Android, adding a track, changing the password, and how to reset the app on a phone.

## Testing

- Automated (`node --test`): encryption format round trip, key wrapping/unwrapping, wrong-password failure, catalog parsing and grouping, "what needs downloading" logic.
- Manual on the owner's iPhone (and an Android if available): first-run unlock, locked playback, lock-screen controls, end of track, airplane-mode launch, adding a track later.

## Left to the builder (marked as Claude's calls)

- Plain HTML/CSS/JS with ES modules, no framework and no build step. *(Claude's call: small app, easier to maintain, nothing to break)*
- Greeting text by time of day. *(Claude's call)*
- A small "now playing" bar at the bottom of the library while a track plays, so the player can be reopened. *(Claude's call: not in the mockup, but needed to get back to the player after swiping it down)*
- Short session descriptions in the sheet use group + approximate length only, until the owner writes descriptions. *(Claude's call)*
- Cover sizes (e.g. 1200 px for the player, 600 px for tiles), app icon derived from the dusk palette, exact spacing and type. *(Claude's call)*
- The throwaway repo `toringe/sleepy-spike` is deleted once Sleepy is live – only when the owner confirms.
