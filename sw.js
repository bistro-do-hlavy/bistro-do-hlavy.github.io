// Jediné místo, kde se při vydání mění verze aplikace.
const CACHE_VERSION = 'bistro-v1.0.53';
const APP_SHELL = [
  './', './index.html', './css/styles.css', './js/app.js',
  './config.js', './content.js', './storage.js',
  './fsrs-service.js', './study.js', './manifest.webmanifest', './img/icon.svg',
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
  './img/products/vilgain-avokadovy-olej-ve-spreji-200-ml.webp',
  './img/products/vilgain-ghi-ve-spreji-s-avokadovym-olejem-200-ml.webp',
  './img/products/vilgain-kokosovy-olej-ve-spreji-200-ml.webp',
  './img/products/vilgain-cocka-cervena-500-g.webp',
  './img/products/vilgain-cocka-cerna-beluga-300-g.webp',
  './img/products/vilgain-chia-seminka-250-g.webp',
  './img/products/vilgain-bio-mini-cookies-cashew-choco-walnut-100-g.webp',
  './img/products/vilgain-popcorn-modra-kukurice-100-g.webp',
  './img/products/vilgain-double-trouble-dvojita-cokolada-55-g.webp',
  './img/products/ovocnak-ovocne-kostky-130-g.webp',
  './img/products/ovocnak-ovocny-puf-hruska-22-g.webp',
  './img/products/dayup-fruit-orange.webp',
  './img/products/okovital-bar-bez-zelatiny-80-g.webp',
  './img/products/ichoc-salty-pretzel-80-g.webp',
  './img/products/mixit-cokoladove-nadeleni-450-g.webp',
  './img/products/torres-tapas-pickle-40-g.webp',
  './img/products/vilgain-ryzove-nudle-1-mm-240-g.webp',
  './img/products/vilgain-ryzove-nudle-3-mm-240-g.webp',
  './img/products/vilgain-seminkovy-topper-natural-500-g.webp',
  './img/products/country-life-quinoa-bio-250-g.webp',
  './img/products/country-life-cizrna-bio-500-g.webp',
  './img/products/country-life-fazole-bila-velka-bio-500-g.webp',
  './img/products/country-life-fazole-cervena-ledvina-bio-500-g.webp',
  './img/products/country-life-fazole-pinto-bio-500-g.webp',
  './img/products/country-life-kuskus-bio-500-g.webp',
  './img/products/country-life-bulgur-psenicny-bio-500-g.webp',
  './img/products/country-life-pohanka-loupana-kroupy-bio-500-g.webp',
  './img/products/country-life-sezam-cerny-neloupany-bio-100-g.webp',
  './img/products/bezva-dynova-seminka-500-g.webp',
  './img/products/bezva-kokosove-chipsy-250-g.webp',
  './img/products/bezva-lyofilizovany-banan-platky-55-g.webp',
  './img/products/la-fabbrica-spaghetti-di-gragnano-igp-500-g.webp',
  './img/products/garden-delights-pimiento-rojo-tiras-330-g.webp',
  './img/products/casa-rinaldi-sugo-bruschetta-350-g.webp',
  './img/products/lozano-cervenka-mandle-v-cukru-100-g.webp',
  './img/products/fu-shou-quick-cooking-noodles-500-g.webp',
  './img/products/vilgain-kecup-bez-pridaneho-cukru-310-g.webp',
  './img/products/vilgain-horcice-350-g.webp',
  './img/products/country-life-olej-slunecnicovy-smazeni-peceni-bio-1-l.webp',
  './img/products/country-life-umeocet-500-ml.webp',
  './img/products/country-life-tamari-sojova-omacka-500-ml.webp',
  './img/products/mlyn-bohutin-mouka-hladka-2-kg.webp',
  './img/products/mlyn-bohutin-mouka-polohruba-2-kg.webp',
  './img/products/mlyn-bohutin-mouka-psenicna-chlebova-2-kg.webp',
  './img/products/mlyn-bohutin-mouka-zitna-chlebova-2-kg.webp',
  './img/products/mlyn-bohutin-mouka-zitna-celozrnna-2-kg.webp',
  './img/products/mlyn-bohutin-mouka-spaldova-celozrnna-2-kg.webp',
  './img/products/sufan-kesu-natural-w240-200-g.webp',
  './img/products/sufan-kokosova-hnizda-s-kesu-170-g.webp',
  './img/products/mixitella-crunchy-dubajsky-krem-kataifi-220-g.webp',
  './img/products/mixit-precliky-slany-karamel-250-g.webp',
  './img/products/mixit-orisky-z-pece-lanyz-pepr-160-g.webp',
  './img/products/la-fabbrica-farfalle-giganti-igp-500-g.webp',
  './img/products/la-fabbrica-penne-de-zite-rigate-igp-500-g.webp',
  './img/products/la-fabbrica-paccheri-lisci-igp-500-g.webp',
  './img/products/torres-selecta-evoo-40-g.webp',
  'https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.2/+esm'
];

self.addEventListener('install', (event) => {
  const freshShell = APP_SHELL.map((url) => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(freshShell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

async function networkFirst(request, fallbackKey = request) {
  const cache = await caches.open(CACHE_VERSION);

  try {
    const response = await fetch(request, { cache: 'no-store' });
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
