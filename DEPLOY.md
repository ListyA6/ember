# Ember — Hostinger Deploy (fit.sidestudio.id)

Laravel app that serves the Ember PWA. Deploy = Hostinger git pull (no SSH/composer),
the proven Argent pattern. `vendor/` is committed; migrations run via `/setup?key=...`.

## 0. One-time backup (before the first deploy)
- hPanel → Databases → export the OLD tracker DB `u841253279_fit` (keep the `.sql`).
  (The old tracker's PHP + config are already saved locally at
  `memory/fitness_tracker_backend/`.)

## 1. Create the database
- hPanel → Databases → MySQL → create DB **`u841253279_ember`** + a DB user.
  Note the generated password.

## 2. Connect the git deploy
- hPanel → Advanced → GIT → **Create a New Repository**:
  - **Repository:** `https://github.com/ListyA6/ember.git`  (public → HTTPS, no SSH key needed)
  - **Branch:** `main`
  - **Directory:** `main`  (deploys into the fit docroot's `main/` subfolder)
- Copy the webhook URL from the GIT page → add it to GitHub
  `ListyA6/ember` → Settings → Webhooks → (Content type: application/json) so every
  push auto-pulls.

## 3. Point the subdomain at Laravel's `public/`  ← CRITICAL (security)
- hPanel → Subdomains → `fit.sidestudio.id` → set **Document Root** to:
  `.../main/public`
- Never the repo root — that would expose `.env` (DB password, app key) to the internet.

## 4. Create the server `.env`  (do NOT paste via File Manager — it mangles long keys)
Create `.../main/.env` with:
```
APP_NAME=Ember
APP_ENV=production
APP_KEY=            # generate locally: `php artisan key:generate --show` and paste the value
APP_DEBUG=false
APP_URL=https://fit.sidestudio.id

SESSION_DRIVER=file        # avoids the DB-session chicken-and-egg on first run

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=u841253279_ember
DB_USERNAME=u841253279_ember
DB_PASSWORD=<the password from step 1>

SETUP_KEY=<a long random string>
```

## 5. Migrate + verify
- Visit `https://fit.sidestudio.id/setup?key=<SETUP_KEY>` once → runs migrations.
- Visit `https://fit.sidestudio.id` → the Ember PWA loads.

## Updating later
- `git push` → the webhook auto-pulls. For asset changes, cache-bust (`?v=N` on script
  tags + bump the `sw.js` cache name) so the PWA picks them up.

## Scope note
This is **Plan 1** (skeleton). The app is still localStorage-only — accounts, pairing,
and multi-device sync arrive in Plans 2 & 3.
