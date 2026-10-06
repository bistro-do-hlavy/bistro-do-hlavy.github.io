const CACHE_VERSION = 'bistro-v1.0.45';
const APP_SHELL = [
  './', './index.html', './css/styles.css?v=1.0.45', './js/app.js?v=1.0.45',
  './config.js?v=1.0.45', './content.js?v=1.0.45', './storage.js?v=1.0.45',
  './fsrs-service.js?v=1.0.45', './study.js?v=1.0.45', './manifest.webmanifest', './img/icon.svg',
  './img/icon-192.png', './img/icon-512.png', './img/icon-maskable-512.png',
  './img/bistrous-test.webp', './img/bistrous-test-wrong.webp', './img/bistrous-goal.webp',
  './data/products.json', './data/questions.json', './data/pending-products.json',
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
  './img/products/henri-willig-gouda-chili-hot-spicy.webp',
  './img/products/bezva-datle-cele-500-g.webp',
  './img/products/bezva-brusinky-klikva-500-g.webp',
  './img/products/bezva-goji-250-g.webp',
  './img/products/bezva-pohankova-kase-300-g.webp',
  './img/products/bezva-ryzova-kase-300-g.webp',
  './img/products/miscela-doro-gusto-classico-250-g.webp',
  './img/products/kaffeebrewda-colombia-el-pastelito-250-g.webp',
  './img/products/kaffeebrewda-ethiopia-chelchele-250-g.webp',
  './img/products/kaffeebrewda-brasil-pantano-red-ruby-250-g.webp',
  './img/products/patifu-gourmet-100-g.webp',
  './img/products/minor-figures-barista-oat-1-l.webp',
  './img/products/temporin-tagliatelle-1-kg.webp',
  './img/products/rodopi-ayran-500-ml.webp',
  './img/products/rodopi-bily-jogurt-200-g.webp',
  './img/products/farma-zelenka-krepelci-vejce-18-ks.webp',
  './img/products/farma-zelenka-slepici-vejce-10-ks.webp',
  './img/products/carmen-reserva-mezcla.webp',
  './img/products/bezva-bananove-kousky-nesirene-500-g.webp',
  './img/products/pasane-gnocchi-con-patate-500-g.webp',
  './img/products/country-life-sul-morska-jemna-bio.webp',
  './img/products/country-life-kakao-bio-150-g.webp',
  './img/products/bio-nebio-mauritius-cukr-500-g.webp',
  './img/products/henri-willig-green-pesto.webp',
  './img/products/huizer-kaas-gilde-walnut-cheese.webp',
  './img/products/le-petit-savoyard-saucisson-noix-200-g.webp',
  './img/products/teahouse-exclusives-sencha-15.webp',
  './img/products/teahouse-exclusives-gunpowder-mint-15.webp',
  './img/products/teahouse-exclusives-english-breakfast-15.webp',
  './img/products/teahouse-exclusives-jasmine-15.webp',
  './img/products/teahouse-exclusives-pure-camomile-15.webp',
  './img/products/teahouse-exclusives-rooibos-vanilla-15.webp',
  './img/products/miscela-doro-espresso-zrnkova-250-g.webp',
  './img/products/miscela-doro-espresso-mleta-250-g.webp',
  './img/products/miscela-doro-espresso-decaffeinato-250-g.webp',
  './img/products/vilgain-protein-milkshake-kakao-330-ml.webp',
  './img/products/bio-nebio-cekankovy-sirup-450-g.webp',
  './img/products/miscela-doro-black-armonia-10-kapsli.webp',
  './img/products/miscela-doro-blue-leggerezza-dec-10-kapsli.webp',
  './img/products/la-gloria-riojana-salchichon-sarta-230-g.webp',
  './img/products/temporin-tortellini-prosciutto-crudo-250-g.webp',
  './img/products/fermato-simrato-150-g.webp',
  './img/products/fermato-mad-bbq-salsa-verde-200-ml.webp',
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

  const isFreshAppFile = url.origin === self.location.origin
    && (url.pathname.includes('/data/') || /\.(?:css|js|webmanifest)$/.test(url.pathname));

  if (isFreshAppFile) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
