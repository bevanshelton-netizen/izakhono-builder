/* IZAKHONO PWA shell worker. Never cache API, auth, or tenant data. */
'use strict';
const CACHE = 'izakhono-app-shell-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/izakhono-mark.svg', '/icons/izakhono-mark-maskable.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('izakhono-app-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.startsWith('/.well-known/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put('/', copy));
      }
      return response;
    }).catch(async () => (await caches.match('/')) || new Response('IZAKHONO is offline. Reconnect and try again.', {status: 503, headers: {'content-type':'text/plain; charset=utf-8'}})));
    return;
  }
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
