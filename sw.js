const CACHE_VERSION = 'bistro-v1.0.16';
const APP_SHELL = [
  './', './index.html', './css/styles.css?v=1.0.16', './js/app.js?v=1.0.16',
  './config.js?v=1.0.16', './content.js?v=1.0.16', './storage.js?v=1.0.16',
  './fsrs-service.js?v=1.0.16', './study.js?v=1.0.16', './manifest.webmanifest', './img/icon.svg',
  './img/icon-192.png', './img/icon-512.png', './img/icon-maskable-512.png',
  './data/products.json', './data/questions.json',
  './img/products/konopny-olej-v-presu.webp', './img/products/casa-rinaldi-balsamico-tresen.webp',
  './img/products/makovy-olej-v-presu.webp', './img/products/kachni-pastika-calvados-melememaso.webp',
  './img/products/tiparos-rybi-omacka.webp',
  './img/products/caffe-barbaro-miscela-blu.webp', './img/products/kitl-syrob-grapefruit.webp',
  './img/products/sufan-granola-malinova.webp', './img/products/bezva-musli-spekane-paleo.webp',
  './img/products/vladimir-pernik-do-kafe.webp',
  './img/products/miscela-doro-espresso-gran-crema.webp',
  './img/products/kaffee-braun-espresso-no1.webp', './img/products/la-brasiliana-europa.webp',
  './img/products/teahouse-exclusives-assam-gfbop.webp', './img/products/chicory-cup-instant-100-g.webp',
  './img/products/dr-oetker-bio-kakao-90-g.webp', './img/products/bio-nebio-javorovy-sirup-grade-c-250-ml.webp',
  './img/products/kavova-mandlovka-200-ml.webp', './img/products/habla-del-silencio-750-ml.webp',
  './img/products/honoro-vera-monastrell-750-ml.webp', './img/products/condado-de-oriza-roble-750-ml.webp',
  'https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.2/+esm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request, fallbackKey = request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') await cache.put(fallbackKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(fallbackKey);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(CACHE_VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, './index.html'));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.includes('/data/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
