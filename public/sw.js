/**
 * Chopaeng Progressive Web App (PWA) Service Worker
 * Provides offline caching, fast asset loading, and catalog persistence.
 */

const CACHE_NAME = 'chopaeng-v2.0.41';
const CATALOG_CACHE = 'chopaeng-catalog-v2.0.41';

// Core shell assets to pre-cache on install
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/logo.webp',
    '/banner.png',
    '/icons/favicon.ico',
    '/icons/favicon-32x32.png',
    '/icons/favicon-16x16.png',
    '/icons/apple-touch-icon.png',
    '/icons/android-chrome-192x192.png',
    '/icons/android-chrome-512x512.png',
    '/icons/site.webmanifest',
];

// Install Event — Pre-cache App Shell
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS).catch((err) => {
                console.warn('[SW] Pre-cache error:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate Event — Clean up stale caches
self.addEventListener('activate', (event) => {
    const expectedCaches = [CACHE_NAME, CATALOG_CACHE];
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (!expectedCaches.includes(key)) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event — Smart caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and browser extensions
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // 1. API Calls & Dynamic Island Status — Network First (do not stale cache live Dodos)
    if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/dashboard/api/') ||
        url.hostname.includes('dodo.chopaeng.com')
    ) {
        event.respondWith(
            fetch(request).catch(() => {
                return new Response(JSON.stringify({ error: 'Offline', isOffline: true }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' },
                });
            })
        );
        return;
    }

    // 2. Large Static Catalog (`explorer.json`) — Stale-While-Revalidate
    if (url.pathname.includes('explorer.json')) {
        event.respondWith(
            caches.open(CATALOG_CACHE).then(async (cache) => {
                const cachedResponse = await cache.match(request);
                const fetchPromise = fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            cache.put(request, networkResponse.clone());
                        }
                        return networkResponse;
                    })
                    .catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );
        return;
    }

    // 3. Static CDN Assets & Images (ACNH CDN, Fonts, Icons) — Cache First with Network Fallback
    if (
        url.hostname.includes('acnhcdn.com') ||
        url.hostname.includes('dodo.ac') ||
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com') ||
        url.hostname.includes('jsdelivr.net') ||
        request.destination === 'image' ||
        request.destination === 'font'
    ) {
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                return fetch(request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);
            })
        );
        return;
    }

    // 4. HTML Navigations (SPA Routing) — Network First, fall back to /index.html when offline
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => {
                return caches.match('/index.html') || caches.match('/');
            })
        );
        return;
    }

    // 5. App Bundles (JS/CSS) — Stale-While-Revalidate
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            const fetchPromise = fetch(request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const clone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return networkResponse;
            }).catch(() => cachedResponse);

            return cachedResponse || fetchPromise;
        })
    );
});
