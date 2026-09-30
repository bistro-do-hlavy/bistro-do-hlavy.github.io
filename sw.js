const CACHE_VERSION = 'bistro-v1.0.10';
const APP_SHELL = [
  './', './index.html', './css/styles.css?v=1.0.10', './js/app.js?v=1.0.10',
  './config.js?v=1.0.10', './content.js?v=1.0.10', './storage.js?v=1.0.10',
  './fsrs-service.js?v=1.0.10', './study.js?v=1.0.10', './manifest.webmanifest', './img/icon.svg',
  './img/icon-192.png', './img/icon-512.png', './img/icon-maskable-512.png',
  './data/products.json', './data/questions.json',
  './img/products/konopny-olej-v-presu.webp', './img/products/casa-rinaldi-balsamico-tresen.webp',
  './img/products/makovy-olej-v-presu.webp', './img/products/kachni-pastika-calvados-melememaso.webp',
  './img/products/tiparos-rybi-omacka.webp',
  'https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.2/+esm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match('./index.html'))));
});
