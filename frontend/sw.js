/**
 * SwiftPOS Service Worker
 * Handles offline caching, background sync, and push notifications
 * Strategy: Cache-First for static assets, Network-First for API calls
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `swiftpos-static-${CACHE_VERSION}`;
const API_CACHE = `swiftpos-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `swiftpos-images-${CACHE_VERSION}`;

// Static assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/js/app.js',
  '/js/modules/auth.js',
  '/js/modules/pos.js',
  '/js/modules/products.js',
  '/js/modules/dashboard.js',
  '/js/modules/transactions.js',
  '/js/modules/inventory.js',
  '/js/utils/api.js',
  '/js/utils/storage.js',
  '/js/utils/receipt.js',
  '/js/utils/sync.js',
  '/manifest.json',
  // External CDN libs (cache at runtime)
];

// API endpoints to cache with Network-First strategy
const API_PATTERNS = [
  /\/api\/products/,
  /\/api\/categories/,
  /\/api\/dashboard/,
];

// ─── Install Event ────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting(); // Activate immediately
      })
      .catch(err => console.warn('[SW] Cache failed:', err))
  );
});

// ─── Activate Event ───────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('swiftpos-') && ![STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(key))
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      ),
      self.clients.claim(), // Take control of all open tabs
    ])
  );
});

// ─── Fetch Event ──────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Chrome extensions
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API calls: Network-First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    const isGETCacheable = API_PATTERNS.some(p => p.test(url.pathname));

    if (isGETCacheable) {
      event.respondWith(networkFirstForAPI(request));
    }
    return;
  }

  // Images: Cache-First
  if (request.destination === 'image') {
    event.respondWith(cacheFirstForImages(request));
    return;
  }

  // Static assets: Cache-First with network fallback
  event.respondWith(cacheFirstForStatic(request));
});

// ─── Cache Strategies ─────────────────────────────────────────────────────────

/** Network-First: Try network, fall back to cache */
async function networkFirstForAPI(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Cache successful responses for 5 minutes
      const cloned = networkResponse.clone();
      const headers = new Headers(cloned.headers);
      headers.set('sw-cached-at', Date.now().toString());
      cache.put(request, cloned);
    }
    return networkResponse;
  } catch (err) {
    console.log('[SW] Network failed, serving from cache:', request.url);
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, message: 'Offline - cached data unavailable', offline: true }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 }
    );
  }
}

/** Cache-First: Serve from cache, update in background */
async function cacheFirstForStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Return offline fallback for HTML navigation
    if (request.destination === 'document') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

/** Image caching */
async function cacheFirstForImages(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('', { status: 404 });
  }
}

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-offline-transactions') {
    event.waitUntil(syncOfflineTransactions());
  }
});

async function syncOfflineTransactions() {
  try {
    // Get offline queue from IndexedDB (managed by sync.js)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OFFLINE_TRANSACTIONS' });
    });
    console.log('[SW] Sync message sent to clients');
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'SwiftPOS', {
      body: data.body || 'Notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'pos-notification',
      data: data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

// ─── Message Handler ──────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_URLS') {
    caches.open(STATIC_CACHE).then(cache => {
      cache.addAll(event.data.urls);
    });
  }
});
