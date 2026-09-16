const CACHE_VERSION = '117';
const CACHE_NAME = 'dermrecord-v' + CACHE_VERSION;
const CACHE_QUERY = '?v=' + CACHE_VERSION;

const APP_SHELL = [
    './',
    './index.html',
    './index.html' + CACHE_QUERY,
    './css/tailwind.css' + CACHE_QUERY,
    './css/app.css' + CACHE_QUERY,
    './js/state.js' + CACHE_QUERY,
    './js/diagnosis-catalogue.js' + CACHE_QUERY,
    './js/crypto.js' + CACHE_QUERY,
    './js/vault.js' + CACHE_QUERY,
    './js/ui.js' + CACHE_QUERY,
    './js/topical.js' + CACHE_QUERY,
    './js/billing.js' + CACHE_QUERY,
    './js/margin-guide.js' + CACHE_QUERY,
    './js/skin-check.js' + CACHE_QUERY,
    './js/consent.js' + CACHE_QUERY,
    './js/clinic-profile.js' + CACHE_QUERY,
    './js/aftercare.js' + CACHE_QUERY,
    './js/letters.js' + CACHE_QUERY,
    './js/outputs.js' + CACHE_QUERY,
    './js/excision.js' + CACHE_QUERY,
    './js/lesion-vault.js' + CACHE_QUERY,
    './js/billing-vault.js' + CACHE_QUERY,
    './js/chart-vault.js' + CACHE_QUERY,
    './js/note-vault.js' + CACHE_QUERY,
    './js/consent-vault.js' + CACHE_QUERY,
    './js/auth.js' + CACHE_QUERY,
    './js/management.js' + CACHE_QUERY,
    './js/chart.js' + CACHE_QUERY,
    './js/procedure-session.js' + CACHE_QUERY,
    './js/app.js' + CACHE_QUERY,
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-192-maskable.png',
    './icons/icon-512-maskable.png'
];

function sameOriginUrl(request) {
    try {
        return new URL(request.url).origin === self.location.origin;
    } catch (err) {
        return false;
    }
}

function cacheCandidates(request) {
    const url = new URL(request.url);
    const path = url.pathname || '/';
    const relative = '.' + (path.endsWith('/') ? path : path);
    const names = [
        request.url,
        path + url.search,
        path,
        path + CACHE_QUERY,
        relative,
        relative + CACHE_QUERY
    ];
    if (path === '/' || path.endsWith('/index.html') || path.endsWith('/')) {
        names.push('./', './index.html', './index.html' + CACHE_QUERY);
    }
    return [...new Set(names)];
}

async function matchAppCache(request) {
    const cache = await caches.open(CACHE_NAME);
    const exact = await cache.match(request);
    if (exact) return exact;
    if (!sameOriginUrl(request)) return undefined;
    for (const candidate of cacheCandidates(request)) {
        const hit = await cache.match(candidate);
        if (hit) return hit;
    }
    return undefined;
}

function isAppShellRequest(request) {
    if (!sameOriginUrl(request)) return false;
    const url = new URL(request.url);
    return APP_SHELL.some((entry) => {
        const listed = new URL(entry, self.location.href);
        if (listed.pathname !== url.pathname) return false;
        if (!listed.search) return !url.search || url.search === CACHE_QUERY;
        return listed.search === url.search || url.search === '' || url.search === CACHE_QUERY;
    });
}

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

    event.respondWith((async () => {
        try {
            const response = await fetch(request);
            if (response && response.status === 200 && response.type === 'basic' && isAppShellRequest(request)) {
                const copy = response.clone();
                const cache = await caches.open(CACHE_NAME);
                await cache.put(request, copy);
            }
            return response;
        } catch (err) {
            const cached = await matchAppCache(request);
            if (cached) return cached;
            throw err;
        }
    })());
});
