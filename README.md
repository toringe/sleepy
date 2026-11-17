# Sleepy

A small, private sleep-audio app for iPhone and Android. Open it in bed, tap a session, lock the phone and drift off. It works fully offline once it has been unlocked, and it costs nothing to run: it is a web app (PWA) hosted on GitHub Pages.

The audio is published **encrypted**. Only someone with the password can listen; the session titles and cover photos are public.

**App:** https://toringe.github.io/sleepy/

## Install on iPhone

1. Open the link above in **Safari** (not Chrome).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open **Sleepy** from the home screen (not from Safari).
4. Enter the password and tap **Unlock**. Stay on Wi-Fi until "Preparing your sleep sessions…" is finished (about 270 MB).

After that it works in airplane mode. Playback continues when the phone is locked, and you can pause from the lock screen.

## Install on Android

1. Open the link in **Chrome**.
2. Tap **Install app** (or ⋮ → **Add to Home screen** → **Install**).
3. Open Sleepy from the home screen, enter the password, and stay on Wi-Fi until it is prepared.

## Adding a track

Requirements: a Mac with Node 20+ (uses the built-in `afinfo` and `sips`). The audio should be an `.m4a` (AAC) file, ideally loudness-matched to −20 LUFS like the others.

A session with **one** sound (no label is shown):

```sh
node tools/add-track.mjs --session drift --title "Drift into Sleep" --group falling-asleep \
  --sound voice --audio "path/to/Drift into Sleep.m4a" --cover "path/to/cover.jpg"
```

A session with **several** sounds – run once per sound, with a `--label` for each:

```sh
node tools/add-track.mjs --session unwind --title "Unwind into Sleep" --group falling-asleep \
  --sound rain --label Rain --audio "path/to/Unwind with Rain.m4a" --cover "path/to/cover.jpg"
node tools/add-track.mjs --session unwind --title "Unwind into Sleep" --group falling-asleep \
  --sound music --label Music --audio "path/to/Unwind with Music.m4a"
```

- `--group` is `falling-asleep` or `back-to-sleep`.
- `--cover` is required the first time a session is added (any large JPG; it is resized).
- Running it again for the same `--session` and `--sound` replaces that track.
- The password is asked for (hidden). For scripts you can set `SLEEPY_PASSWORD` instead.

Then check and publish:

```sh
node tools/verify.mjs          # every track should say OK
git add catalog.json audio covers
git commit -m "Add Drift into Sleep"
git push
```

Phones pick up the new track the next time Sleepy is opened with internet; nobody needs to enter the password again. To remove a track, delete its entry from `catalog.json` and its file from `audio/`, then commit and push.

## Changing the password

```sh
node tools/change-password.mjs
git add key.enc && git commit -m "Change password" && git push
```

Only `key.enc` changes. Phones that are already unlocked keep working; new installs need the new password.

## Resetting the app on a phone

- **iPhone:** press and hold the Sleepy icon → **Delete Bookmark** (this also deletes its stored audio). Reinstall from Safari.
- **Android:** long-press the icon → **App info** → **Uninstall**, or in Chrome: Settings → Site settings → All sites → toringe.github.io → **Clear & reset**.

## How it works

- `catalog.json` lists groups, sessions and their sounds (title, length, encrypted file).
- `key.enc` holds a random 256-bit content key, encrypted with the password (PBKDF2-SHA256, 600 000 iterations → AES-256-GCM).
- `audio/*.enc` are the tracks encrypted with the content key (AES-256-GCM). File names include a content hash, so a replaced track gets a new name.
- On unlock the phone stores the content key (non-extractable) and the decrypted tracks in IndexedDB and asks for persistent storage.
- `sw.js` keeps the app, catalog and covers available offline. **When you change any app file (`index.html`, `css/`, `js/`), bump `VERSION` in `sw.js`**, otherwise phones keep the old version.
- Unencrypted audio and video are git-ignored (`*.m4a`, `*.mp4`, `tmp/`). Never commit them.

## Development

```sh
npm test                         # unit tests (no dependencies)
python3 -m http.server 8080      # then open http://localhost:8080
```
