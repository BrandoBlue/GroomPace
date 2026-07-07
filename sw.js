const CACHE_NAME = 'groompace-v0.8.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&family=Fraunces:opsz,wght@9..144,400..700&display=swap'
];

const CORE_ASSETS = ['./index.html', './style.css', './app.js'];
const CORE_ASSET_PATHS = new Set(CORE_ASSETS.map(p => '/' + p.replace('./', '')));
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function isCoreAsset(url) {
  try { return CORE_ASSET_PATHS.has(new URL(url).pathname); }
  catch { return false; }
}

function isFontRequest(url) {
  return FONT_HOSTS.some(h => url.includes(h));
}

function cacheableResponse(response) {
  if (!response || response.status !== 200) return false;
  return response.type === 'basic' || response.type === 'cors';
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(cacheNames.map(cache => cache !== CACHE_NAME ? caches.delete(cache) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Network-first for app shell so HTML/CSS/JS stay in sync on deploy
  if (event.request.mode === 'navigate' || isCoreAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (cacheableResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => {
          if (r) return r;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        }))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        const canCache = cacheableResponse(networkResponse) && event.request.method === 'GET'
          && (networkResponse.type === 'basic' || isFontRequest(url));
        if (canCache) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
