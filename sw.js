const CACHE = 'zenflow-racer-2026-v1';
const SHELL = ['./', './index.html', './core.js', './fallback-renderer.js', './world.js', './vehicles.js', './game.js', './polish.css', './pwa.js', './manifest.webmanifest', './vendor/three.min.js', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('zenflow-racer-') && key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
