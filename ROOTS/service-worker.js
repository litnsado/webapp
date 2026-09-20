/* ROOTS service worker — offline-first shell, fresh data */
const VERSION    = 'roots-v1';
const SHELL      = `${VERSION}-shell`;
const RUNTIME    = `${VERSION}-runtime`;
const IMAGES     = `${VERSION}-images`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/directory.html',
  '/onboard.html',
  '/profile.html',
  '/css/style.css',
  '/js/app.js',
  '/js/supabase.js',
  '/assets/logo/logo.svg',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname.endsWith('.supabase.co')) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.startsWith('/storage/v1/object/public/')) {
    e.respondWith(
      caches.match(request).then((hit) =>
        hit || fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(IMAGES).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(request).then((hit) => {
        const net = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
