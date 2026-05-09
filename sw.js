// Service Worker — Ayushman PhysioFIT
const CACHE_NAME = 'ayushman-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin-dashboard.html',
  '/staff-dashboard.html',
  '/patient-dashboard.html',
  '/payment.html',
  '/membership.html',
  '/sessions.html',
  '/reports.html',
  '/style.css',
  '/firebase.js',
  '/images/logo.png',
  '/images/logo_transparent.png'
];

// Install — cache assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — serve from cache first
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// Push Notification
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Ayushman PhysioFIT';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'view') {
    e.waitUntil(clients.openWindow(e.notification.data.url));
  }
});
