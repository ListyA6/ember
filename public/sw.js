/* Ember service worker — offline-first app shell cache. */
const CACHE = 'ember-v6';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './styles/fonts.css', './styles/tokens.css', './styles/base.css', './styles/components.css', './styles/animations.css',
  './styles/trainer.css', './styles/run.css',
  './assets/fonts/space-grotesk-latin-500-normal.woff2', './assets/fonts/space-grotesk-latin-600-normal.woff2', './assets/fonts/space-grotesk-latin-700-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-400-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-500-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-600-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-700-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-800-normal.woff2',
  './js/icons.js', './js/store.js', './js/ui.js', './js/charts.js', './js/router.js', './js/share.js', './js/seed.js',
  './js/views/onboarding.js', './js/views/dashboard.js', './js/views/workout.js', './js/views/feed.js',
  './js/views/challenges.js', './js/views/stats.js', './js/views/profile.js', './js/views/settings.js',
  './js/views/trainer.js', './js/views/run.js',
  './js/app.js', './assets/icon.svg', './assets/icon-maskable.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // network-first for same-origin navigations, cache-first for assets
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => cached))
  );
});
