# Ember Pact — fit.sidestudio.id

Private 2-person weight-loss pact app (static PWA + PHP API). Deployed to the
`fit.sidestudio.id` web root via Hostinger git deploy (install path `/`).

- `api.php` — backend (Bearer token, PDO/MySQL, `pact_*` tables auto-create).
- `config.php` — **server-only**, not in git (holds DB creds). Create it on the
  server from `config.sample.php`. Blocked from the web by `.htaccess`.
- `uploads/` — server-only proof photos, not in git.

The previous Ember (Laravel) app is preserved on the **`ember-laravel-archive`** branch.
