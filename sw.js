const CACHE_NAME = 'dermrecord-v54';

const APP_SHELL = [
    './',
    './index.html',
    './css/app.css',
    './js/state.js',
    './js/crypto.js',
    './js/vault.js',
    './js/ui.js',
    './js/topical.js',
    './js/billing.js',
    './js/skin-check.js',
    './js/consent.js',
    './js/aftercare.js',
    './js/outputs.js',
    './js/excision.js',
    './js/lesion-vault.js',
    './js/billing-vault.js',
    './js/chart-vault.js',
    './js/note-vault.js',
    './js/auth.js',
    './js/management.js',
    './js/chart.js',
    './js/procedure-session.js',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-192-maskable.png',
    './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            for (const url of APP_SHELL) {
                try {
                    await cache.add(url);
                } catch (err) {
                    // Skip missing files so a single 404 cannot block install
                }
            }
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    event.respondWith(
        fetch(request).then((response) => {
            if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
                const copy = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
        }).catch(() => caches.match(request))
    );
});
