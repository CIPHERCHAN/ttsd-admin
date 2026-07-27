const CACHE = 'ttsd-admin-v8';
const ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', e => {
  self.skipWaiting(); // activate this version immediately instead of waiting for old tabs to close
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // take control of already-open tabs right away
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('googleapis.com')) return; // never cache API calls — always live

  // Network-first, and explicitly bypass the browser's own HTTP cache layer
  // (not just the Service Worker Cache API). Without { cache: 'no-store' },
  // a plain fetch() can still be silently answered from the browser's normal
  // HTTP cache if the host sends caching headers on index.html — meaning
  // "network-first" code can still serve a stale file even though it looks
  // like it's doing the right thing. no-store forces an actual round trip.
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
