/* ============================================================
   FisherSafe — Service Worker
   Caches app shell + map tiles for offline use
   ============================================================ */

const CACHE_NAME = 'fishersafe-v3';
const TILE_CACHE = 'fishersafe-tiles-v3';

// App shell files to cache immediately
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/main.css',
  '/css/map.css',
  '/css/components.css',
  '/js/app.js',
  '/js/gps.js',
  '/js/map.js',
  '/js/boundary.js',
  '/js/alerts.js',
  '/js/storage.js',
  '/js/logbook.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Roboto+Condensed:wght@400;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

// Install: cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES.filter(u => !u.startsWith('http') || u.includes('fonts') || u.includes('leaflet') || u.includes('unpkg'))))
      .catch(err => console.warn('Shell cache error (expected offline):', err))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== TILE_CACHE).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, network fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Map tiles: cache-first with network fallback
  if (url.hostname.includes('tile') || url.pathname.includes('/tiles/')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(response => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // App shell: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Return index.html for navigation requests (SPA fallback)
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
