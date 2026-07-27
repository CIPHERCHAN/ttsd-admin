const CACHE = 'ttsd-admin-v7';
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

  // Network-first: always try to fetch the current file when online, and quietly
  // refresh the cache with whatever comes back. Only fall back to the cached
  // copy if the network request fails (i.e. genuinely offline). This is what
  // fixes the "stuck on an old build forever" problem — a cache-first strategy
  // only refreshes when sw.js itself changes, which meant index.html updates
  // alone were never picked up.
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
