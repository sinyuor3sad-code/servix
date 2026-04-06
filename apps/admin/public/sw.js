/// <reference lib="webworker" />

const CACHE_VERSION = 'v2';
const CACHE_NAME = 'servix-admin-' + CACHE_VERSION;
const API_CACHE = 'servix-admin-api-' + CACHE_VERSION;

// Critical pages to precache
const PRECACHE_URLS = [
  '/',
  '/offline',
];

// ── Install — Force activate immediately ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        console.log('[SW] Some precache URLs failed, continuing...');
      });
    })
  );
  self.skipWaiting();
});

// ── Activate — Delete ALL old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.includes(CACHE_VERSION))
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// ── Fetch Strategies ──
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and non-http
  if (event.request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — Network only. Never cache API responses.
  // Admin panel must always show real-time data.
  if (url.pathname.startsWith('/api/') || url.hostname.includes('api.')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ success: false, message: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Next.js static assets (/_next/static/) — Network first.
  // These files are content-hashed, so new builds produce new filenames.
  // We MUST fetch from network first to pick up new chunks after deployment.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || new Response('', { status: 503 })))
    );
    return;
  }

  // Other static assets (icons, fonts, images) — Cache first (safe, rarely change)
  if (url.pathname.match(/\.(woff2?|png|jpg|jpeg|svg|webp|ico|avif)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages — Network first with offline fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/offline') || new Response(
              '<html dir="rtl"><body style="background:#040406;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1 style="font-size:48px;margin:0">SERVIX</h1><p style="color:#94A3B8;margin-top:12px">لا يوجد اتصال بالإنترنت</p></div></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ── Push Notifications ──
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'SERVIX', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      dir: 'rtl',
      lang: 'ar',
      tag: data.tag || 'servix-admin-notification',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
