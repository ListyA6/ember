# Ember — Personal Fitness Command Center

*Train. Track. Burn.* A personal, Strava-style fitness app — just for you. Built as a
**zero-build progressive web app**: no install, no build step, no server required. Just open it.
You can still share any single workout as an image card; there's no social feed, likes, or
friends — it's your private training log.

![accent](https://img.shields.io/badge/accent-ember%20orange-ff6a13) (white + orange · glassmorphism · emoji-free)

## How to run

**Easiest (XAMPP — already on your machine):**
Apache serves this folder. Open:

```
http://localhost:8080/!PROJECTBANK/ember/
```

(Start Apache in the XAMPP control panel first. Port is 8080 per your setup.)

**Or just double-click `index.html`** — it also runs straight from the file system.
(The service worker / offline install only activates over `http://`, so prefer the XAMPP URL
to install it as an app.)

**Install it like a native app:** open the XAMPP URL on your phone or in Chrome/Edge →
browser menu → *Install / Add to Home Screen*. It then runs full-screen and works offline.

## What's inside

- **Home** — time-aware greeting, today's workout, daily-steps streak, this-week snapshot,
  active goals, and your recent activity.
- **Workout logger** — your Upper/Lower program carried over from the old tracker, with set
  logging (weight × reps), live session + rest timers, gym-photo capture, and automatic
  personal-record detection.
- **Quick log (the + button)** — walks, runs, rides, cardio, or a bodyweight entry.
- **Activity** — your personal training log, with PR ribbons, photos, and one-tap
  **shareable cards** (rendered to an image you can post).
- **Goals** — set personal targets (step streaks, workout counts, distance, volume, minutes)
  with a deadline and watch the progress ring close. Finished goals land in a "Finished" list.
- **Stats** — weight trend, weekly volume, a consistency heatmap, and your personal records.
- **Profile** — your stats and unlockable **badges**.
- **Settings** — metric/imperial, accent + light/dark, goals, full data backup/restore,
  and an optional sync hook.

## Sharing

There's no social layer — this is your private log. To share a single session, open any
activity and tap **Share**: it renders a branded image card (orange gradient, your stats) and
hands it to the OS share sheet, or downloads a PNG you can post yourself.

To share **all** of your training data as one file, go to **Settings → Data → Share training
data**. On a phone this opens the share sheet (send it to yourself via WhatsApp); on desktop it
downloads a single `ember-training-YYYY-MM-DD.json` you can attach. That file holds everything —
hand it to Claude for analysis, no account or server required.

Everything is local-first (stored in your browser). Nothing leaves your device unless you
export a backup or turn on sync.

## First run

On first launch the app seeds itself with your real Week-1 training baseline plus a few starter
goals, so it's alive immediately. To start clean:
**Settings → Reset all data** (then it shows the onboarding screen).

## Tech

Vanilla HTML/CSS/JS. No dependencies. Architecture:

```
index.html                 app shell + script order
assets/fonts/              self-hosted Space Grotesk + Plus Jakarta Sans (woff2, offline)
styles/                    fonts · tokens · base · components · animations  (the design system)
js/
  icons.js                 inline SVG icon set (no emoji)
  store.js                 single source of truth (localStorage, events)
  ui.js                    DOM builder, sheets, toasts, formatters, FX
  charts.js                animated SVG charts (ring/line/bars/heatmap/sparkline)
  router.js                hash routing + animated transitions + bottom nav
  share.js                 canvas share-card generator
  seed.js                  first-run data
  app.js                   bootstrap + shared flows (quick-add, log weight/activity)
  views/                   one file per screen (self-register with the router)
sw.js, manifest.webmanifest, assets/icon*.svg   PWA bits
```

`CONTRACT.md` documents the full internal API if you want to extend it.

## Optional: cloud sync

The data model has a sync hook to the existing `fit.sidestudio.id` pattern (Settings → Sync,
**off by default**). Leave it off until the backend endpoint is confirmed for this app's
schema; the app is fully functional without it.
