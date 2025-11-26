// A simple service worker for offline capability

const CACHE_NAME = 'surgifile-pwa-v3'; // Incremented version for recent updates
const URLS_TO_CACHE = [
  './',
  'index.html',
  'app.js',
  'events.js',
  'db.js',
  'file-system.js',
  'billing-view.js',
  'entry-view.js',
  'settings-view.js',
  'modals.js',
  'icon-192.png',
  'icon-512.png',
  'manifest.json'
];

// Install event: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(URLS_TO_CACHE);
      })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event: serve from cache first
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Not in cache - fetch from network
        return fetch(event.request);
      }
    )
  );
});
