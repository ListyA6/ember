/* /pact/ is retired. This kill-switch service worker replaces the old one:
   it purges every cache, unregisters itself, and navigates open clients to
   the root app. Belt-and-suspenders with pact/index.html's self-heal script. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try {
      const ks = await caches.keys();
      await Promise.all(ks.map(function (k) { return caches.delete(k); }));
    } catch (err) {}
    try { await self.registration.unregister(); } catch (err) {}
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(function (c) { try { c.navigate('/'); } catch (err) {} });
  })());
});
/* Pass everything through to the network (no caching). */
self.addEventListener('fetch', function () {});
