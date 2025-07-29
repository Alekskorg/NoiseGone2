const STATIC_CACHE  = 'ng-static-v1';
const RUNTIME_CACHE = 'ng-runtime-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/main.js',
  '/worker.js',
  '/manifest.webmanifest',
  'https://fonts.gstatic.com/s/inter/v12/…' /* можно добавить точные URL Inter */,
];

// install
self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// activate
self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// fetch
self.addEventListener('fetch', (evt) => {
  const { request } = evt;

  // network-first для мок-API
  if (request.url.includes('/api/clean')) {
    evt.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // stale-while-revalidate для остальной статики
  evt.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((networkResp) => {
        caches.open(RUNTIME_CACHE).then((c) =>
          c.put(request, networkResp.clone())
        );
        return networkResp;
      });
      return cached || fetchPromise;
    })
  );
});
