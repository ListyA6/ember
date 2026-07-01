/* Ember Pact service worker — offline-first app shell cache.
   IMPORTANT: never cache api.php (the shared ledger must stay live). */
const CACHE = 'pact-v4';
const API_TOKEN = 'd81c3b70208130fcc0693ddde0b740cb1ff91cb5cb9252519fb5bcdd0e34ba6a';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './styles/fonts.css', './styles/tokens.css', './styles/base.css', './styles/components.css', './styles/animations.css',
  './assets/fonts/space-grotesk-latin-500-normal.woff2', './assets/fonts/space-grotesk-latin-600-normal.woff2', './assets/fonts/space-grotesk-latin-700-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-400-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-500-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-600-normal.woff2',
  './assets/fonts/plus-jakarta-sans-latin-700-normal.woff2', './assets/fonts/plus-jakarta-sans-latin-800-normal.woff2',
  './js/icons.js', './js/store.js', './js/pact.js', './js/pact-sync.js', './js/pact-push.js', './js/ui.js', './js/charts.js', './js/router.js', './js/share.js', './js/seed.js',
  './js/views/account.js', './js/views/dashboard.js', './js/views/workout.js', './js/views/walk.js',
  './js/views/schedule.js', './js/views/feed.js', './js/views/recap.js', './js/views/stats.js',
  './js/views/profile.js', './js/views/settings.js',
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
  // never serve the API or uploads from cache — always hit the network
  if (/\/api\.php|\/uploads\//.test(req.url)) return;
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

// ---- Web Push (payload-less): fetch the latest partner activity, then show it ----
self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let title = 'Ember Pact', body = 'New activity — tap to open';
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const r = await fetch('./api.php?action=notifications', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + API_TOKEN, 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint, markSeen: 1 })
        });
        const j = await r.json();
        if (j && j.ok && j.events && j.events.length) body = j.events[j.events.length - 1].text;
      }
    } catch (err) { /* offline or fetch failed → keep the generic body */ }
    await self.registration.showNotification(title, {
      body, icon: './assets/icon.svg', badge: './assets/icon.svg',
      tag: 'pact-activity', renotify: true, data: { url: './' }
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) { try { c.navigate('./'); } catch (err) {} return c.focus(); } }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
