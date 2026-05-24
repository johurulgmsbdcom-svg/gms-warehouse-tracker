// sw.js - GMS MCD ERP Service Worker (Offline-First PWA)
const CACHE_NAME = 'gms-erp-v1';
const OFFLINE_PAGE = '/index.html';

// প্রি-ক্যাশ করা হবে এমন ফাইল/লিংক
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/notice.html',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap'
];

// 🔹 Install: ফাইল ক্যাশ করবে
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] CDN cache failed (CORS/Network), continuing anyway:', err);
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting(); // নতুন ভার্সন এলে পুরনোটা সরিয়ে দিবে
});

// 🔹 Activate: পুরনো ক্যাশ ক্লিন করবে
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim(); // সব ট্যাবে সাথে সাথে অ্যাক্টিভ হবে
});

// 🔹 Fetch: ক্যাশ-ফার্স্ট স্ট্র্যাটেজি
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached; // ক্যাশে থাকলে সাথে সাথে দেখাবে

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // নেটওয়ার্ক ফেইল হলে ফলব্যাক
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_PAGE);
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// 🔹 Message: ক্লায়েন্ট থেকে আপডেট রিকোয়েস্ট
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 🔹 Background Sync: ইন্টারনেট ফিরলে অটো সিঙ্ক ট্রিগার
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'TRIGGER_AUTO_SYNC' });
        });
      })
    );
  }
});
