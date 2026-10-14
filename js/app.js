import { CONFIG } from '../config.js';
import { contentProvider } from '../content.js';
import { storage } from '../storage.js';
import { RATINGS, getIntervals, rebuildProgress } from '../fsrs-service.js';
import {
  buildProgressFromReviews,
  buildStudyQueue,
  buildTopicStudyQueue,
  buildWeakStudyQueue,
  calculateStreak,
  evaluateText,
  learningInsights,
  normalizeText,
  productMastery,
  questionWeakness,
  ratingLabel,
} from '../study.js';

const ALLERGENS = {
  1: 'Obiloviny s lepkem', 2: 'Korýši', 3: 'Vejce', 4: 'Ryby', 5: 'Arašídy',
  6: 'Sójové boby', 7: 'Mléko', 8: 'Skořápkové plody', 9: 'Celer', 10: 'Hořčice',
  11: 'Sezam', 12: 'Oxid siřičitý a siřičitany', 13: 'Vlčí bob', 14: 'Měkkýši',
};

const TYPE_LABELS = { mcq: 'Výběr', flashcard: 'Kartička', text: 'Napsat', photo: 'Foto výzva' };
const QUESTION_TYPE_SETTINGS = [
  { id: 'mcq', label: 'Výběr z možností', description: 'Jedna správná odpověď ze čtyř.' },
  { id: 'flashcard', label: 'Kartičky', description: 'Odpověď si vybavíte a sami ohodnotíte.' },
  { id: 'text', label: 'Napsat odpověď', description: 'Odpověď napíšete vlastními slovy.' },
  { id: 'photo', label: 'Foto výzva', description: 'Podle fotografie určíte kategorii, výrobce nebo vlastnost.' },
];
const BISTROUS_LINES = {
  correct: [
    'Správně. Etiketa se právě dobrovolně přiznala.',
    'Tohle byste prodali i se zavřenýma očima.',
    'Mozek právě získal michelinskou hvězdu.',
    'Výborně. Produkt už před vámi nic neutají.',
    'Trefa! Bistrouš hrdě zvedá lžíci.',
    'Tohle máte v hlavě lépe než ve skladu.',
    'Čistá práce. Ani drobeček pochybností.',
    'Správně. Znalost čerstvá jako dnešní závoz.',
    'Ano! Přesně takhle chutná správná odpověď.',
    'Bez zaváhání. Regál uznale přikývl.',
    'Výborně. Výrobce by měl radost.',
    'To byla odpověď s dokonale vyváženou chutí.',
    'Správně. Bistrouš nemusí zasahovat.',
    'Tohle už z hlavy jen tak nevyvětrá.',
    'Ano. Etiketa prohrála na celé čáře.',
    'Profesionální výkon. Zástěra zůstává čistá.',
    'Tohle bylo rychlejší než káva s sebou.',
    'Správně. Přesně tak se krotí sortiment.',
  ],
  wrong: [
    'Těsně vedle. Tohle sousto si dáme znovu.',
    'Mozek právě objednal opakování.',
    'Etiketa vyhrála první kolo. Odveta bude vaše.',
    'Tohle nám trochu spadlo pod stůl.',
    'Nevadí. I mistr někdy zamění kuskus za bulgur.',
    'Dneska ne. Příště už vás nenachytá.',
    'Produkt: 1. Vy: zatím 0.',
    'Zkusíme znovu, tentokrát bez vaření z vody.',
    'Tohle nebyla odpověď. To byl gastronomický freestyle.',
    'Bistrouš se právě podrbal na mozku.',
    'Vedle jak ta jedle. A tu ani nemáme v sortimentu.',
    'Chyba není průšvih. Jen dražší způsob učení.',
    'Tady nám paměť trochu zkysla.',
    'Odvážná volba. Správná bohužel nebyla.',
    'Tak určitě. A ocet je dekorace.',
    'Správná odpověď se schovávala hned vedle.',
    'Tohle by zákazník reklamoval.',
    'Nic se neděje. Zboží vracíme do oběhu.',
  ],
  streak: [
    'Regály se začínají bát.',
    'Jedete jako kávovar v ranní špičce.',
    'Začíná z vás být chodící katalog.',
    'Tahle série je čerstvější než dnešní závoz.',
    'Bistrouš nestíhá rozdávat pochvaly.',
    'Etikety si mezi sebou šeptají vaše jméno.',
    'Tohle už není štěstí. Tohle je podezřelé.',
    'Ještě chvíli a budete školit i Bistrouše.',
    'Sklad znalostí hlásí plnou kapacitu.',
    'Pozor, profesionál v uličce!',
  ],
  recovery: [
    'Tohle dřív zlobilo. Teď už ani drobeček nejistoty.',
    'Odveta vyhrána. Tenhle produkt už vás nenachytá.',
    'Slabé místo právě povýšilo na silnou stránku.',
    'Minule zádrhel, dnes čistá práce.',
    'Bistrouš potvrzuje: pokrok nalezen a uložen.',
    'Tenhle regál jste si právě srovnali v hlavě.',
  ],
  repeat: [
    'Tenhle produkt se vrací častěji než stálý zákazník.',
    'Dobře, tenhle výrobek si s vámi očividně něco vyřizuje.',
    'Třetí schůzka. Už byste si mohli tykat.',
    'Zase on. Začíná to být osobní.',
    'Bistrouš ho dává stranou. Ještě se mu podíváme na etiketu.',
    'Tenhle kousek odmítá opustit trénink.',
    'Nebojte, časem ho unavíme.',
    'Výrobek vede, ale zápas ještě nekončí.',
    'Zítra ho poznáte i zezadu a potmě.',
    'Připravujeme další odvetu.',
  ],
  photo: [
    'Obal mlčí. Teď mluvíte vy.',
    'Nápis jsme schovali. Znalosti ne.',
    'Poznáte ho i bez toho, aby se představil?',
    'Logo odpočívá. Detektiv nastupuje.',
    'Teď se ukáže, kdo se opravdu dívá.',
    'Žádné čtení etikety. Pouze čistý instinkt.',
    'Produkt v utajení. Odhalte ho.',
    'Bistrouš zabavil tahák.',
  ],
  comparison: [
    'Do regálu vstupují dva soupeři.',
    'Podobný obal, úplně jiný příběh.',
    'Dnes rozhodují detaily.',
    'Který z nich si zaslouží správnou polici?',
    'Souboj bez rukavic, zato s alergeny.',
    'Dva produkty vstupují. Jedna odpověď odchází.',
    'Nenechte se zmást pěknou etiketou.',
    'Bistrouš zahajuje produktové derby.',
  ],
  reveal: [
    'Karty na stůl. Tohle je správná odpověď.',
    'Etiketa odkryta. Teď si ji uložte do hlavy.',
    'Bistrouš servíruje odpověď bez přílohy.',
    'Chvilka pravdy. Jak blízko jste byli?',
  ],
  goal: [
    'Denní porce znalostí snědena. Talíř je čistý!',
    'Hotovo. Regály se začínají bát.',
    'Denní cíl splněn. Bistrouš smeká čepici.',
    'Dnes namarkováno. Mozek hlásí plný sklad.',
    'Výborně! Dnešní znalosti jsou bezpečně v hlavě.',
    'Zavřít kasu, dnešní trénink je hotový.',
    'Denní dávka splněna. Zástěra může na věšák.',
    'Bistrouš potvrzuje: pro dnešek máte odpracováno.',
  ],
  loading: [
    'Bistrouš rovná regály…',
    'Počítám olivy. Jedna, dvě, někdo jednu snědl…',
    'Hledám alergen drobným písmem…',
    'Leštím správné odpovědi…',
    'Ochutnávám data…',
    'Vážím otázky bez obalu…',
    'Kontroluji, zda ocet opravdu není dekorace…',
    'Míchám témata. Netřepat…',
    'Připravuji čerstvou várku otázek…',
    'Lovím informace ze zadní strany obalu…',
    'Přepočítávám mozkové závity…',
    'Hledám produkt, který se schoval za těstoviny…',
  ],
  return: [
    'Vítejte zpátky. Produkty se samy nenaučí.',
    'Bistrouš oprášil čepici. Jdeme na to.',
    'Regál je plný a výmluvy vyprodané.',
    'Dnes máme na menu několik záludností.',
    'Paměť předehřátá. Můžeme začít.',
    'Dobré zprávy: nic jsme bez vás nesnědli.',
    'Zboží čeká. Mozek také.',
    'Bistrouš už si myslel, že jste se ztratili mezi regály.',
    'Dnešní specialita: vědět víc než včera.',
    'Čerstvá várka otázek právě dorazila.',
  ],
};
let mascotMomentTimer;
let lastBistrousLine = '';
const loadingCopy = document.querySelector('.loading-state p');
if (loadingCopy) loadingCopy.textContent = BISTROUS_LINES.loading[Math.floor(Math.random() * BISTROUS_LINES.loading.length)];
const GLOSSARY = [
  { id: 'aeropress', label: 'AeroPress', matches: ['AeroPress', 'Aeropress'], definition: 'Ruční pomůcka pro přípravu kávy, která protlačí vodu a kávu přes papírový nebo kovový filtr pomocí pístu.' },
  { id: 'chemex', label: 'Chemex', matches: ['Chemex'], definition: 'Skleněná nádoba pro filtrovanou kávu se silnějším papírovým filtrem. Výsledkem bývá čistý a jemný nápoj.' },
  { id: 'arabika', label: 'Arabika', matches: ['Arabika', 'Arabiky', 'Arabiku'], definition: 'Káva druhu Coffea arabica. Obvykle bývá aromatičtější, jemnější a kyselejší než Robusta.' },
  { id: 'robusta', label: 'Robusta', matches: ['Robusta', 'Robusty', 'Robustu'], definition: 'Káva druhu Coffea canephora. Mívá vyšší obsah kofeinu, výraznější hořkost a podporuje plné tělo i cremu espressa.' },
  { id: 'crema', label: 'Crema', matches: ['crema', 'cremou'], definition: 'Jemná pěnová vrstva na povrchu správně připraveného espressa, vznikající působením tlaku na kávu.' },
  { id: 'moka-konvicka', label: 'Moka konvička', matches: ['moka konvička', 'moka konvičky', 'moka konvičce'], definition: 'Kovová konvička na sporák, ve které tlak páry vytlačí horkou vodu přes mletou kávu.' },
  { id: 'tomatillos', label: 'Tomatillos', matches: ['tomatillos'], definition: 'Zelené plody mochyně pocházející z Mexika. Mají svěží, lehce nakyslou chuť a jsou základem mnoha zelených sals.' },
  { id: 'epazote', label: 'Epazote', matches: ['epazote'], definition: 'Výrazná mexická bylina používaná k dochucení fazolí, omáček a dalších tradičních jídel.' },
  { id: 'umami', label: 'Umami', matches: ['umami'], definition: 'Jedna ze základních chutí. Popisuje plnou, masitou a dlouhotrvající chuť typickou například pro fermentované výrobky.' },
  { id: 'prosciutto-crudo', label: 'Prosciutto crudo', matches: ['prosciutto crudo', 'prosciuttem crudo'], definition: 'Italská sušená, tepelně neopracovaná šunka vyráběná solením a dlouhým zráním vepřové kýty.' },
  { id: 'salchichon', label: 'Salchichón', matches: ['salchichón', 'salchichónu'], definition: 'Španělská sušená uzenina z vepřového masa, obvykle kořeněná hlavně pepřem; na rozdíl od chorizu nebývá jejím hlavním kořením paprika.' },
  { id: 'sarta', label: 'Sarta', matches: ['sarta'], definition: 'Označení pro uzeninu vytvarovanou do podkovy nebo smyčky.' },
  { id: 'secuansky-pepr', label: 'Sečuánský pepř', matches: ['sečuánský pepř', 'sečuánským pepřem'], definition: 'Aromatické oplodí rostlin rodu Zanthoxylum. Není to pravý pepř; typické je citrusové aroma a lehce znecitlivující pocit na jazyku.' },
  { id: 'fermentace', label: 'Fermentace', matches: ['fermentace', 'fermentovaný', 'fermentovaná', 'fermentované', 'fermentovaných'], definition: 'Řízená přeměna surovin pomocí mikroorganismů. Může měnit chuť, vůni, kyselost i trvanlivost potraviny.' },
];
const GLOSSARY_MATCHES = GLOSSARY.flatMap((entry) => entry.matches.map((match) => ({ ...entry, match })))
  .sort((a, b) => b.match.length - a.match.length);
const GLOSSARY_PATTERN = new RegExp(GLOSSARY_MATCHES.map(({ match }) => match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'giu');
const state = {
  catalogProducts: [], catalogQuestions: [], products: [], questions: [], reviews: [], progress: {}, profile: null, settings: null,
  productNotes: {}, pendingProducts: [], currentView: 'home', session: null, homeProductIds: [],
};
const catalogState = { query: '', filter: 'all', sort: 'recommended', scrollY: 0, visited: false };

const app = document.querySelector('#app');
const profileDialog = document.querySelector('#profile-dialog');
const productDialog = document.querySelector('#product-dialog');
const topicDialog = document.querySelector('#topic-dialog');
const glossaryDialog = document.querySelector('#glossary-dialog');
const toast = document.querySelector('#toast');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function glossaryEntryForMatch(value) {
  const normalized = value.toLocaleLowerCase('cs');
  return GLOSSARY_MATCHES.find(({ match }) => match.toLocaleLowerCase('cs') === normalized);
}

function renderGlossaryText(value) {
  const text = String(value ?? '');
  let cursor = 0;
  let html = '';
  for (const match of text.matchAll(GLOSSARY_PATTERN)) {
    const entry = glossaryEntryForMatch(match[0]);
    html += escapeHtml(text.slice(cursor, match.index));
    html += `<button class="glossary-term" type="button" data-glossary-id="${entry.id}" aria-label="${escapeHtml(match[0])} – vysvětlit pojem">${escapeHtml(match[0])}</button>`;
    cursor = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(cursor));
}

function openGlossary(id) {
  const entry = GLOSSARY.find((item) => item.id === id);
  if (!entry) return;
  glossaryDialog.returnFocusTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.querySelector('#glossary-title').textContent = entry.label;
  document.querySelector('#glossary-definition').textContent = entry.definition;
  glossaryDialog.showModal();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function randomBistrousLine(group) {
  const lines = BISTROUS_LINES[group] || BISTROUS_LINES.correct;
  const choices = lines.filter((line) => line !== lastBistrousLine);
  const line = choices[Math.floor(Math.random() * choices.length)] || lines[0];
  lastBistrousLine = line;
  return line;
}

function hideBistrous() {
  clearTimeout(mascotMomentTimer);
  const current = document.querySelector('.bistrous-moment');
  if (!current) return;
  current.classList.remove('is-visible');
  setTimeout(() => current.remove(), 260);
}

function showBistrousMoment(kind, line, duration = 3200, mood = 'right') {
  hideBistrous();
  const moment = document.createElement('aside');
  const entrances = ['from-left', 'from-right', 'from-top'];
  const entrance = kind === 'goal' ? 'from-bottom' : entrances[Math.floor(Math.random() * entrances.length)];
  moment.className = `bistrous-moment is-${kind} ${entrance}`;
  moment.setAttribute('role', 'status');
  moment.setAttribute('aria-live', 'polite');

  const image = document.createElement('img');
  image.src = kind === 'goal' ? './img/bistrous-goal.webp' : mood === 'wrong' ? './img/bistrous-test-wrong.webp' : './img/bistrous-test.webp';
  image.alt = '';
  image.width = kind === 'goal' ? 220 : 180;
  image.height = kind === 'goal' ? 248 : 165;

  const bubble = document.createElement('p');
  bubble.textContent = line;
  moment.append(image, bubble);
  if (Math.random() < .14) {
    const olive = document.createElement('span');
    olive.className = 'bistrous-olive';
    olive.setAttribute('aria-hidden', 'true');
    olive.textContent = '●';
    moment.append(olive);
  }
  document.body.append(moment);
  requestAnimationFrame(() => requestAnimationFrame(() => moment.classList.add('is-visible')));
  mascotMomentTimer = setTimeout(hideBistrous, duration);
}

function applyTheme(theme) {
  const resolvedTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme;
  document.documentElement.dataset.theme = resolvedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'light' ? '#f3ead8' : '#071a15');
}

function updateProfileChip() {
  const name = state.profile?.nickname || 'Profil';
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-initial').textContent = name.slice(0, 1).toLocaleUpperCase('cs');
}

function archivedProducts() {
  const archived = new Set(state.settings?.archivedProductIds || []);
  return state.catalogProducts.filter((product) => archived.has(product.id));
}

function refreshActiveContent() {
  const archived = new Set(state.settings?.archivedProductIds || []);
  state.products = state.catalogProducts.filter((product) => !archived.has(product.id));
  const activeProductIds = new Set(state.products.map((product) => product.id));
  state.questions = state.catalogQuestions.filter((question) => activeProductIds.has(question.productId));
  if (state.homeProductIds.some((id) => !activeProductIds.has(id)) || state.homeProductIds.length < Math.min(3, state.products.length)) {
    selectRandomHomeProducts();
  }
}

function selectRandomHomeProducts() {
  const shuffled = [...state.products];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  state.homeProductIds = shuffled.slice(0, 3).map((product) => product.id);
}

function homeProducts() {
  const byId = new Map(state.products.map((product) => [product.id, product]));
  return state.homeProductIds.map((id) => byId.get(id)).filter(Boolean);
}

function shuffledCopy(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function selectedProductIds() {
  const available = new Set(state.products.map((product) => product.id));
  const saved = state.settings?.enabledProductIds;
  if (!Array.isArray(saved)) return [...available];
  return saved.filter((id) => available.has(id));
}

function questionIsEnabled(question) {
  const enabledTypes = new Set(state.settings?.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  const enabledProducts = new Set(selectedProductIds());
  return enabledTypes.has(question.type) && enabledProducts.has(question.productId);
}

function sessionQuestionLimit() {
  return ({ 3: 5, 5: 10, 10: 20 })[Number(state.settings?.sessionMinutes)] || 10;
}

function limitedQueue(queue) {
  return queue.slice(0, sessionQuestionLimit());
}

function dueCount(now = new Date()) {
  return state.questions.filter((question) => questionIsEnabled(question) && state.progress[question.id] && new Date(state.progress[question.id].due) <= now).length;
}

function tomorrowCount() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  return state.questions.filter((question) => questionIsEnabled(question) && state.progress[question.id] && new Date(state.progress[question.id].due) <= end).length;
}

function masteredProducts() {
  return state.products.filter((product) => productMastery(product.id, state.questions, state.progress) === 100).length;
}

function totalMastery() {
  if (!state.products.length) return 0;
  const sum = state.products.reduce((acc, product) => acc + productMastery(product.id, state.questions, state.progress), 0);
  return Math.round(sum / state.products.length);
}

function masteryStatus(value) {
  if (value <= 0) return 'Nevyzkoušeno';
  if (value < 35) return 'Začínáte';
  if (value < 70) return 'Upevňujete';
  if (value < 100) return 'Téměř jisté';
  return 'Zvládnuto';
}

function masteryRing(value, label = '', className = '') {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const accessibleLabel = label ? `${label}: ${safeValue} procent, ${masteryStatus(safeValue)}` : `${safeValue} procent, ${masteryStatus(safeValue)}`;
  return `<span class="mastery-ring ${className}" style="--mastery:${safeValue}" role="img" aria-label="${escapeHtml(accessibleLabel)}">
    <span class="mastery-ring-center"><strong>${safeValue} %</strong>${label ? `<small>${escapeHtml(label)}</small>` : ''}</span>
  </span>`;
}

async function updateBadge() {
  if (!('setAppBadge' in navigator)) return;
  const count = dueCount();
  try { count ? await navigator.setAppBadge(count) : await navigator.clearAppBadge(); } catch { /* nepodporovaná oprávnění */ }
}

function setActiveNav(view) {
  document.querySelectorAll('[data-view-link]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.viewLink === view);
  });
}

function navigate(view) {
  hideBistrous();
  const previousView = state.currentView;
  if (previousView === 'products' && view !== 'products') catalogState.scrollY = window.scrollY;
  document.body.classList.remove('is-studying');
  state.currentView = view;
  state.session = view === 'study' ? state.session : null;
  setActiveNav(view);
  if (view === 'home') renderHome();
  if (view === 'products') renderProducts();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
  if (view === 'products' && catalogState.visited) {
    requestAnimationFrame(() => window.scrollTo({ top: catalogState.scrollY, behavior: 'instant' }));
  } else {
    window.scrollTo({ top: 0, behavior: previousView === view ? 'smooth' : 'instant' });
  }
  if (view === 'products') catalogState.visited = true;
}

function productRows(products = state.products) {
  return products.map((product) => {
    const mastery = productMastery(product.id, state.questions, state.progress);
    return `
      <button class="mini-product" type="button" data-product-id="${product.id}">
        <img src="${product.image}" alt="" width="80" height="80">
        <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span>
        <span class="percent">${mastery} %</span>
      </button>`;
  }).join('');
}

function renderHome() {
  const queue = limitedQueue(buildStudyQueue({
    ...state,
    newCardsPerDay: state.settings.newCardsPerDay,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  }));
  const due = dueCount();
  const streak = calculateStreak(state.reviews);
  const insights = learningInsights(state);
  const weakest = insights.weakProducts[0];
  const weakQueue = buildWeakStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  const enabledProductIds = new Set(selectedProductIds());
  const recognitionCount = photoChallengeQuestions().filter((question) => enabledProductIds.has(question.productId)).length;
  const comparisonCount = comparisonQuestions().length;
  const scenarioCount = scenarioQuestions().length;
  const showBaseline = !state.settings.baselineCompleted && state.reviews.length === 0;
  const overallMastery = totalMastery();
  const categoryHighlights = insights.categoryInsights.slice(0, 3);
  const nextAction = weakQueue.length
    ? {
      title: weakest ? `Upevněte ${weakest.name}` : 'Procvičte slabší otázky',
      description: `${weakQueue.length} ${weakQueue.length === 1 ? 'otázka potřebuje' : weakQueue.length <= 4 ? 'otázky potřebují' : 'otázek potřebuje'} zopakovat.`,
      label: 'Procvičit',
      action: 'weak',
    }
    : queue.length
      ? { title: 'Dokončete dnešní porci', description: 'Krátké pravidelné vybavování upevňuje paměť lépe než dlouhé nárazové učení.', label: 'Pokračovat', action: 'daily' }
      : { title: 'Prohlédněte si další produkty', description: 'Denní cíl máte hotový. Můžete si bez testování projít katalog.', label: 'Otevřít katalog', action: 'products' };
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const dayLabels = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  const weeklyActivity = dayLabels.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const count = state.reviews.filter((review) => {
      const reviewedAt = new Date(review.reviewedAt);
      return reviewedAt >= date && reviewedAt < nextDate;
    }).length;
    const isToday = date.toDateString() === now.toDateString();
    return `<div class="week-day ${count ? 'is-done' : ''} ${isToday ? 'is-today' : ''}"><span>${count ? '✓' : ''}</span><small>${label}</small></div>`;
  }).join('');
  app.innerHTML = `
    <section class="page home-page">
      <article class="hero-card daily-special">
        <div class="hero-top">
          <div class="special-copy">
            <p class="eyebrow">Denní dávka · ${state.settings.sessionMinutes || 5} minut</p>
            <h1>${queue.length ? 'Upevněte, co má dnes smysl' : 'Dnes máte naservírováno'}</h1>
            <p>${queue.length ? `${due} k opakování · ${Math.max(0, queue.length - due)} nových otázek` : 'Skvělá práce. Další porce bude připravená později.'}</p>
          </div>
          ${masteryRing(overallMastery, 'celkem', 'mastery-ring-hero')}
        </div>
        <div class="hero-actions">
          <button id="start-study" class="button button-primary special-button" type="button" aria-label="Denní mix" ${queue.length ? '' : 'disabled'}>
            <span aria-hidden="true">▶</span>${queue.length ? `Spustit doporučený trénink · ${queue.length}` : 'Denní cíl splněn'}
            <span class="visually-hidden">${queue.length} karet dnes</span>
          </button>
        </div>
      </article>
      ${showBaseline ? `<article class="focus-card baseline-card">
        <div><p class="eyebrow">Začněte chytře</p><h2>Co už znáte?</h2><p>Krátký vstupní test rozloží otázky napříč kategoriemi. Výsledek rovnou nastaví první opakování, ale nic vám nezamkne.</p></div>
        <button id="start-baseline" class="button button-primary" type="button">Spustit vstupní test</button>
      </article>` : ''}
      <button id="best-next-action" class="best-next-card" type="button" data-next-action="${nextAction.action}">
        <span class="best-next-icon" aria-hidden="true">↗</span>
        <span><small>Nejlepší další krok</small><strong>${escapeHtml(nextAction.title)}</strong><span>${escapeHtml(nextAction.description)}</span></span>
        <b>${escapeHtml(nextAction.label)} <span aria-hidden="true">›</span></b>
      </button>
      <section class="weekly-board" aria-label="Týdenní pokrok">
        <div class="section-heading"><h2>Týdenní pokrok</h2><span>${streak} ${streak === 1 ? 'den v řadě' : 'dní v řadě'}</span></div>
        <div class="week-row">${weeklyActivity}</div>
        <div class="chalk-note"><span aria-hidden="true">☕</span><p>${streak ? 'Jen tak dál. Paměť má ráda pravidelné malé porce.' : 'I jedna krátká dávka dnes nastartuje novou sérii.'}</p></div>
      </section>
      <section class="mastery-map" aria-labelledby="mastery-map-heading">
        <div class="section-heading"><div><p class="eyebrow">Mapa zvládnutí</p><h2 id="mastery-map-heading">Jak si vedete</h2></div><button class="text-button" type="button" data-view-link="stats">Celý přehled</button></div>
        <div class="mastery-overview">
          <div class="overall-mastery">${masteryRing(overallMastery, 'všechny produkty', 'mastery-ring-large')}<span><strong>${masteredProducts()}/${state.products.length}</strong><small>produktů zvládnuto</small></span></div>
          <div class="category-mastery-grid">
            ${categoryHighlights.map((item) => `<button type="button" class="category-mastery-card" data-home-category="${escapeHtml(item.category)}">${masteryRing(item.mastery, '', 'mastery-ring-category')}<strong>${escapeHtml(item.category)}</strong><span>${masteryStatus(item.mastery)}</span></button>`).join('')}
          </div>
        </div>
      </section>
      <div class="quick-menu compact-training-menu" aria-label="Rychlá volba tréninku">
        <button id="open-topic-study" class="menu-tile" type="button"><span class="menu-tile-icon" aria-hidden="true">☰</span><span><strong>Podle tématu</strong><small>Vyberte kategorii</small></span><b aria-hidden="true">›</b></button>
        <button id="start-weak-home" class="menu-tile" type="button"><span class="menu-tile-icon" aria-hidden="true">⚡</span><span><strong>Co mi nejde</strong><small>${weakQueue.length ? `${weakQueue.length} otázek k upevnění` : 'Žádné slabé místo'}</small></span><b aria-hidden="true">›</b></button>
      </div>
      <details class="training-more">
        <summary><span><strong>Další způsoby tréninku</strong><small>Foto výzva, porovnávání a situace z bistra</small></span><span aria-hidden="true">⌄</span></summary>
        <div class="training-modes-grid">
          <article class="training-mode-card training-mode-photo">
            <span class="training-mode-icon" aria-hidden="true">◎</span>
            <div><p class="eyebrow">Fotografie jako kontext</p><h2>Foto výzva</h2><p>Otázky o kategorii, výrobci a vlastnostech bez opisování názvu z obalu.</p></div>
            <button id="start-recognition" class="button button-secondary button-full" type="button" ${recognitionCount ? '' : 'disabled'}>Spustit · ${Math.min(sessionQuestionLimit(), recognitionCount)}</button>
          </article>
          <article class="training-mode-card training-mode-compare">
            <span class="training-mode-icon" aria-hidden="true">⇄</span>
            <div><p class="eyebrow">Podobné vedle sebe</p><h2>Porovnávání</h2><p>Rozlište podobné produkty podle ověřených vlastností.</p></div>
            <button id="start-comparison" class="button button-secondary button-full" type="button" ${comparisonCount ? '' : 'disabled'}>Spustit · ${Math.min(sessionQuestionLimit(), comparisonCount)}</button>
          </article>
          <article class="training-mode-card training-mode-scenario">
            <span class="training-mode-icon" aria-hidden="true">☕</span>
            <div><p class="eyebrow">Nanečisto před zákazníkem</p><h2>Situace z bistra</h2><p>Praktické dotazy na složení, alergeny, přípravu a doporučení. Odpovědi vycházejí z ověřených produktových otázek.</p></div>
            <button id="start-scenarios" class="button button-secondary button-full" type="button" ${scenarioCount ? '' : 'disabled'}>Spustit · ${Math.min(sessionQuestionLimit(), scenarioCount)}</button>
          </article>
        </div>
      </details>
      <div class="section-heading"><h2>Produkty v kurzu</h2><span>Při každém otevření jiné</span></div>
      <div class="mini-products">${productRows(homeProducts())}</div>
    </section>`;
  bindCommonActions();
  document.querySelector('#start-study')?.addEventListener('click', startStudy);
  document.querySelector('#start-baseline')?.addEventListener('click', startBaselineStudy);
  document.querySelector('#best-next-action')?.addEventListener('click', (event) => {
    const action = event.currentTarget.dataset.nextAction;
    if (action === 'weak') startWeakStudy(weakQueue);
    else if (action === 'products') navigate('products');
    else startStudy();
  });
  document.querySelector('#open-topic-study')?.addEventListener('click', openTopicDialog);
  document.querySelector('#start-weak-home')?.addEventListener('click', () => startWeakStudy(weakQueue));
  document.querySelector('#start-recognition')?.addEventListener('click', startRecognitionStudy);
  document.querySelector('#start-comparison')?.addEventListener('click', startComparisonStudy);
  document.querySelector('#start-scenarios')?.addEventListener('click', startScenarioStudy);
  document.querySelectorAll('[data-home-category]').forEach((button) => button.addEventListener('click', () => startTopicStudy(button.dataset.homeCategory)));
}

function productCard(product) {
  const mastery = productMastery(product.id, state.questions, state.progress);
  const status = masteryStatus(mastery);
  return `<button class="product-card" type="button" data-product-id="${product.id}">
    <span class="product-image-stage"><img src="${product.image}" alt="${escapeHtml(product.name)}" width="240" height="180" loading="lazy"></span>
    <span class="product-card-body"><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.category)}</p>
    <span class="product-progress">${masteryRing(mastery, '', 'mastery-ring-product')}<span><strong>${status}</strong><small>${mastery} % zvládnutí</small></span></span></span>
  </button>`;
}

function productCollection(products, view) {
  if (!products.length) return '<div class="empty-catalog"><strong>Žádný produkt nenalezen</strong><span>Zkuste jiný název nebo kategorii.</span></div>';
  if (view === 'category') {
    const categories = [...new Set(products.map((product) => product.category))];
    return categories.map((category) => {
      const categoryProducts = products.filter((product) => product.category === category);
      return `<section class="catalog-category"><div class="category-heading"><h2>${escapeHtml(category)}</h2><span>${categoryProducts.length}</span></div>
        <div class="product-grid">${categoryProducts.map(productCard).join('')}</div></section>`;
    }).join('');
  }
  return `<div class="product-grid ${view === 'list' ? 'is-list' : ''}">${products.map(productCard).join('')}</div>`;
}

function renderProducts() {
  const view = ['grid', 'list', 'category'].includes(state.settings.productCatalogView) ? state.settings.productCatalogView : 'grid';
  const reviewedQuestionIds = new Set(state.reviews.map((review) => review.questionId));
  const now = new Date();
  const statusByProduct = new Map(state.products.map((product) => {
    const questions = state.questions.filter((question) => question.productId === product.id);
    const reviewed = questions.filter((question) => reviewedQuestionIds.has(question.id));
    const due = questions.some((question) => state.progress[question.id]?.due && new Date(state.progress[question.id].due) <= now);
    const weak = questions.some((question) => questionWeakness(question.id, state.reviews, state.progress[question.id]) >= 25);
    return [product.id, {
      new: reviewed.length === 0,
      due,
      weak,
      mastered: productMastery(product.id, state.questions, state.progress) >= 80,
    }];
  }));
  const filters = [
    { id: 'all', label: 'Všechny', count: state.products.length },
    { id: 'new', label: 'Nevyzkoušené', count: state.products.filter((product) => statusByProduct.get(product.id).new).length },
    { id: 'due', label: 'K opakování', count: state.products.filter((product) => statusByProduct.get(product.id).due).length },
    { id: 'weak', label: 'Slabé', count: state.products.filter((product) => statusByProduct.get(product.id).weak).length },
    { id: 'mastered', label: 'Zvládnuté', count: state.products.filter((product) => statusByProduct.get(product.id).mastered).length },
  ];
  let activeFilter = filters.some((filter) => filter.id === catalogState.filter) ? catalogState.filter : 'all';
  let activeSort = ['recommended', 'weakest', 'newest', 'alphabetical'].includes(catalogState.sort) ? catalogState.sort : 'recommended';
  app.innerHTML = `
    <section class="page">
      <header class="page-header catalog-header"><div><h1>Produkty</h1><p>${state.products.length} produktů · Vyhledejte produkt nebo si katalog seřaďte tak, jak se vám učí nejlépe.</p></div></header>
      <div class="catalog-tools">
        <label class="catalog-search"><span class="visually-hidden">Hledat produkt</span><input id="product-search" type="search" value="${escapeHtml(catalogState.query)}" placeholder="Hledat produkt nebo kategorii…" autocomplete="off"></label>
        <label class="catalog-sort"><span>Seřadit</span><select id="product-sort" aria-label="Seřadit produkty"><option value="recommended" ${activeSort === 'recommended' ? 'selected' : ''}>Doporučené</option><option value="weakest" ${activeSort === 'weakest' ? 'selected' : ''}>Nejslabší napřed</option><option value="newest" ${activeSort === 'newest' ? 'selected' : ''}>Nevyzkoušené napřed</option><option value="alphabetical" ${activeSort === 'alphabetical' ? 'selected' : ''}>Podle názvu A–Z</option></select></label>
        <div class="view-switch" aria-label="Zobrazení produktů">
          <button type="button" data-catalog-view="grid" aria-label="Mřížka" aria-pressed="${view === 'grid'}" title="Mřížka"><span aria-hidden="true">▦</span><span>Mřížka</span></button>
          <button type="button" data-catalog-view="list" aria-label="Seznam" aria-pressed="${view === 'list'}" title="Seznam"><span aria-hidden="true">☷</span><span>Seznam</span></button>
          <button type="button" data-catalog-view="category" aria-label="Kategorie" aria-pressed="${view === 'category'}" title="Podle kategorií"><span aria-hidden="true">≡</span><span>Kategorie</span></button>
        </div>
        <div class="catalog-filters" aria-label="Filtrovat produkty podle učení">
          ${filters.map((filter) => `<button type="button" data-product-filter="${filter.id}" aria-pressed="${filter.id === activeFilter}"><span>${filter.label}</span><strong>${filter.count}</strong></button>`).join('')}
        </div>
      </div>
      <div id="product-collection">${productCollection(state.products, view)}</div>
    </section>`;
  bindCommonActions();
  const updateProductCollection = () => {
    const query = normalizeText(document.querySelector('#product-search').value);
    const filtered = state.products.filter((product) => {
      const matchesText = !query || normalizeText(`${product.name} ${product.category} ${product.brand || ''}`).includes(query);
      const matchesLearning = activeFilter === 'all' || statusByProduct.get(product.id)?.[activeFilter];
      return matchesText && matchesLearning;
    });
    filtered.sort((a, b) => {
      const aStatus = statusByProduct.get(a.id);
      const bStatus = statusByProduct.get(b.id);
      const aMastery = productMastery(a.id, state.questions, state.progress);
      const bMastery = productMastery(b.id, state.questions, state.progress);
      if (activeSort === 'alphabetical') return a.name.localeCompare(b.name, 'cs');
      if (activeSort === 'weakest') return aMastery - bMastery || a.name.localeCompare(b.name, 'cs');
      if (activeSort === 'newest') return Number(bStatus.new) - Number(aStatus.new) || a.name.localeCompare(b.name, 'cs');
      return Number(bStatus.due) - Number(aStatus.due)
        || Number(bStatus.weak) - Number(aStatus.weak)
        || Number(bStatus.new) - Number(aStatus.new)
        || aMastery - bMastery
        || a.name.localeCompare(b.name, 'cs');
    });
    document.querySelector('#product-collection').innerHTML = productCollection(filtered, view);
    bindCommonActions();
  };
  document.querySelector('#product-search').addEventListener('input', updateProductCollection);
  document.querySelector('#product-search').addEventListener('input', (event) => { catalogState.query = event.target.value; });
  document.querySelector('#product-sort').addEventListener('change', (event) => {
    activeSort = event.target.value;
    catalogState.sort = activeSort;
    updateProductCollection();
  });
  document.querySelectorAll('[data-product-filter]').forEach((button) => button.addEventListener('click', () => {
    activeFilter = button.dataset.productFilter;
    catalogState.filter = activeFilter;
    document.querySelectorAll('[data-product-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    updateProductCollection();
  }));
  document.querySelectorAll('[data-catalog-view]').forEach((button) => button.addEventListener('click', async () => {
    catalogState.scrollY = window.scrollY;
    state.settings = await storage.saveSettings({ productCatalogView: button.dataset.catalogView });
    renderProducts();
    requestAnimationFrame(() => window.scrollTo({ top: catalogState.scrollY, behavior: 'instant' }));
  }));
  updateProductCollection();
}

function renderStats() {
  const insights = learningInsights(state);
  const weakQueue = buildWeakStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  const recentAccuracy = insights.recentReviews ? `${insights.recentSecurePercent} %` : '—';
  const thirtyDayAccuracy = insights.thirtyDayReviews ? `${insights.thirtyDaySecurePercent} %` : '—';
  const trendMaximum = Math.max(1, ...insights.dailyTrend.map((day) => day.reviews));
  const categoryRow = (item) => `
    <button class="category-progress-item" type="button" data-stats-category="${escapeHtml(item.category)}">
      <span class="category-progress-copy"><strong>${escapeHtml(item.category)}</strong><small>${item.learnedQuestions}/${item.questionCount} otázek vyzkoušeno · ${item.productCount} ${item.productCount === 1 ? 'produkt' : item.productCount <= 4 ? 'produkty' : 'produktů'}</small></span>
      <span class="category-progress-score"><strong>${item.mastery} %</strong><small>${item.attempts ? `${item.securePercent} % jistých` : 'zatím bez odpovědi'}</small></span>
      <span class="category-progress-track" aria-hidden="true"><span style="width:${item.mastery}%"></span></span>
    </button>`;
  const primaryCategories = insights.categoryInsights.slice(0, 8);
  const remainingCategories = insights.categoryInsights.slice(8);
  const recentMistakes = insights.recentMistakes.map((review) => {
    const question = state.questions.find((item) => item.id === review.questionId);
    const product = state.products.find((item) => item.id === (review.productId || question?.productId));
    return question ? { review, question, product } : null;
  }).filter(Boolean);
  app.innerHTML = `
    <section class="page">
      <header class="page-header"><h1>Statistiky</h1><p>Přehled vychází z vašich odpovědí uložených na tomto zařízení.</p></header>
      <div class="stats-grid stats-grid-detailed" aria-label="Statistiky učení">
        <div class="stat-card"><strong>${insights.totalReviews}</strong><span>${insights.totalReviews === 1 ? 'odpověď celkem' : 'odpovědí celkem'}</span></div>
        <div class="stat-card"><strong>${recentAccuracy}</strong><span>jistých za 7 dní</span></div>
        <div class="stat-card"><strong>${thirtyDayAccuracy}</strong><span>jistých za 30 dní</span></div>
        <div class="stat-card"><strong>${insights.learnedQuestions}/${insights.totalQuestions}</strong><span>vyzkoušených otázek</span></div>
        <div class="stat-card"><strong>${calculateStreak(state.reviews)}</strong><span>${calculateStreak(state.reviews) === 1 ? 'den v sérii' : 'dní v sérii'}</span></div>
      </div>
      <section class="learning-panel trend-panel" aria-labelledby="trend-heading">
        <div class="section-heading"><h2 id="trend-heading">Posledních 7 dní</h2><span>${insights.recentReviews} odpovědí</span></div>
        <div class="trend-chart" aria-label="Počet odpovědí v posledních sedmi dnech">
          ${insights.dailyTrend.map((day) => `<div class="trend-day"><span class="trend-value">${day.reviews || ''}</span><span class="trend-bar"><span style="height:${Math.max(6, Math.round(day.reviews / trendMaximum * 100))}%"></span></span><small>${escapeHtml(day.label)}</small></div>`).join('')}
        </div>
      </section>
      <article class="focus-card">
        <div><p class="eyebrow">Chytré doporučení</p><h2>${weakQueue.length ? `${weakQueue.length} ${weakQueue.length === 1 ? 'otázka' : weakQueue.length <= 4 ? 'otázky' : 'otázek'} k upevnění` : 'Žádné výrazné slabé místo'}</h2>
        <p>${weakQueue.length ? 'Výběr kombinuje chyby, nejisté odpovědi a nízkou stabilitu v paměti. Nejtěžší otázky dostanou přednost a po chybě se vrátí s odstupem.' : state.reviews.length ? 'Pokračujte denní dávkou. Aplikace vás vyzkouší znovu, až začne vzpomínka slábnout.' : 'Nejdřív dokončete několik otázek, aby aplikace poznala, co potřebujete procvičit.'}</p></div>
        <button id="start-weak-study" class="button button-primary" type="button" ${weakQueue.length ? '' : 'disabled'}>Procvičit slabá místa</button>
      </article>
      <div class="section-heading"><h2>Co vám zatím nejde</h2><span>${insights.weakProducts.length ? 'Největší mezery nahoře' : 'Bez problémů'}</span></div>
      <div class="weak-list">
        ${insights.weakProducts.length ? insights.weakProducts.slice(0, 8).map((product) => `
          <button class="weak-product" type="button" data-product-id="${product.productId}">
            <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${product.weakQuestionCount} ${product.weakQuestionCount === 1 ? 'slabá otázka' : product.weakQuestionCount <= 4 ? 'slabé otázky' : 'slabých otázek'}</small></span>
            <span class="weak-score"><strong>${product.securePercent} %</strong><small>jisté</small></span>
          </button>`).join('') : '<div class="empty-catalog"><strong>Zatím tu nic není</strong><span>Slabá místa se zobrazí po prvních trénincích.</span></div>'}
      </div>
      <section class="learning-panel category-progress-panel" aria-labelledby="category-progress-heading">
        <div class="section-heading"><h2 id="category-progress-heading">Pokrok podle kategorií</h2><span>Klepnutím procvičíte</span></div>
        <div class="category-progress-list">${primaryCategories.map(categoryRow).join('')}</div>
        ${remainingCategories.length ? `<details class="more-categories"><summary>Zobrazit další kategorie (${remainingCategories.length})</summary><div class="category-progress-list">${remainingCategories.map(categoryRow).join('')}</div></details>` : ''}
      </section>
      <section class="learning-panel" aria-labelledby="confusion-heading">
        <div class="section-heading"><h2 id="confusion-heading">Nejčastěji zaměňované</h2><span>Porovnávání</span></div>
        <div class="confusion-list">
          ${insights.confusedPairs.length ? insights.confusedPairs.map((pair) => `<div class="confusion-item"><span><strong>${escapeHtml(pair.products[0])}</strong><small>× ${escapeHtml(pair.products[1])}</small></span><b>${pair.count}×</b></div>`).join('') : '<div class="empty-inline"><strong>Zatím bez záměn</strong><span>Po chybné odpovědi v Porovnávání se zde ukážou produkty, které si pletete.</span></div>'}
        </div>
      </section>
      <section class="learning-panel" aria-labelledby="mistakes-heading">
        <div class="section-heading"><h2 id="mistakes-heading">Poslední chyby</h2><span>${recentMistakes.length ? 'Zkuste je znovu' : 'Bez chyb'}</span></div>
        <div class="recent-mistakes">
          ${recentMistakes.length ? recentMistakes.map(({ review, question, product }) => `<article class="mistake-item"><div><strong>${escapeHtml(product?.name || 'Produkt')}</strong><p>${escapeHtml(question.prompt)}</p>${review.selectedAnswer ? `<small>Vaše odpověď: ${escapeHtml(review.selectedAnswer)}</small>` : ''}</div><button class="button button-secondary" type="button" data-retry-question="${question.id}">Zkusit znovu</button></article>`).join('') : '<div class="empty-inline"><strong>Zatím tu nic není</strong><span>Chybné odpovědi se sem uloží, abyste se k nim mohli rychle vrátit.</span></div>'}
        </div>
      </section>
      <details class="research-note"><summary>Jak funguje častější opakování?</summary><p>Plánovač FSRS zkrátí interval po chybě nebo nejisté odpovědi. Otázky se neopakují bezhlavě za sebou: aktivní vybavování je rozložené v čase a přizpůsobené vašim výsledkům.</p></details>
    </section>`;
  bindCommonActions();
  document.querySelector('#start-weak-study')?.addEventListener('click', () => startWeakStudy(weakQueue));
  document.querySelectorAll('[data-stats-category]').forEach((button) => button.addEventListener('click', () => startTopicStudy(button.dataset.statsCategory)));
  document.querySelectorAll('[data-retry-question]').forEach((button) => button.addEventListener('click', () => {
    const question = state.questions.find((item) => item.id === button.dataset.retryQuestion);
    if (question) startStudySession([question], 'weak');
  }));
}

function renderSettings() {
  const enabledQuestionTypes = state.settings.enabledQuestionTypes || Object.keys(TYPE_LABELS);
  const enabledProductIds = selectedProductIds();
  const enabledProductSet = new Set(enabledProductIds);
  const categories = [...new Set(state.products.map((product) => product.category))];
  const archived = archivedProducts();
  const describeQuestionTypes = (types) => types.length === QUESTION_TYPE_SETTINGS.length
    ? 'Mix všech'
    : `${types.length} ${types.length === 1 ? 'typ' : 'typy'} · ${types.map((type) => TYPE_LABELS[type]).join(', ')}`;
  const describeProductScope = (count) => !state.products.length
    ? 'Žádné aktivní produkty'
    : count === state.products.length
    ? 'Všechny produkty'
    : `${count} ${count === 1 ? 'produkt' : count >= 2 && count <= 4 ? 'produkty' : 'produktů'} z ${state.products.length}`;
  app.innerHTML = `
    <section class="page">
      <header class="page-header"><h1>Nastavení</h1></header>
      <div class="settings-list">
        <article class="settings-card">
          <div class="field-row"><div><h2>Nové otázky denně</h2><p>Opakování mají vždy přednost.</p></div>
          <select id="new-limit" aria-label="Počet nových otázek denně">${[3, 5, 10, 15].map((n) => `<option value="${n}" ${state.settings.newCardsPerDay === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        </article>
        <article class="settings-card">
          <div class="field-row"><div><h2>Délka jednoho tréninku</h2><p>Krátká dávka má přibližně 5, běžná 10 a delší 20 otázek.</p></div>
          <select id="session-minutes" aria-label="Délka jednoho tréninku">${[3, 5, 10].map((minutes) => `<option value="${minutes}" ${Number(state.settings.sessionMinutes || 5) === minutes ? 'selected' : ''}>${minutes} min</option>`).join('')}</select></div>
        </article>
        <details class="settings-card collapsible-settings" id="question-type-details">
          <summary>
            <span><strong>Typy otázek v testu</strong><small id="question-types-summary">${describeQuestionTypes(enabledQuestionTypes)}</small></span>
            <span class="disclosure-icon" aria-hidden="true">⌄</span>
          </summary>
          <div class="collapsible-content">
            <p>Vyberte, jakými způsoby chcete produkty procvičovat.</p>
            <button id="mix-all" class="mix-all-button ${enabledQuestionTypes.length === QUESTION_TYPE_SETTINGS.length ? 'is-active' : ''}" type="button">
              <span class="mix-icon" aria-hidden="true">⌘</span>
              <span><strong>Mix všech</strong><small>Prokládat všechny čtyři typy v jedné dávce.</small></span>
              <span class="mix-check" aria-hidden="true">✓</span>
            </button>
            <div class="choice-divider"><span>nebo vlastní výběr</span></div>
            <fieldset class="type-options">
              <legend class="visually-hidden">Povolené typy otázek</legend>
              ${QUESTION_TYPE_SETTINGS.map((type) => `
                <label class="type-option">
                  <span><strong>${type.label}</strong><small>${type.description}</small></span>
                  <input type="checkbox" name="question-type" value="${type.id}" ${enabledQuestionTypes.includes(type.id) ? 'checked' : ''}>
                  <span class="switch" aria-hidden="true"></span>
                </label>`).join('')}
            </fieldset>
          </div>
        </details>
        <details class="settings-card collapsible-settings" id="product-scope-details">
          <summary>
            <span><strong>Z čeho budete zkoušeni</strong><small id="product-scope-summary">${describeProductScope(enabledProductIds.length)}</small></span>
            <span class="disclosure-icon" aria-hidden="true">⌄</span>
          </summary>
          <div class="collapsible-content">
            <p>Vyberte celé kategorie nebo jen jednotlivé produkty.</p>
            <button id="select-all-products" class="mix-all-button ${state.products.length && enabledProductIds.length === state.products.length ? 'is-active' : ''}" type="button" ${state.products.length ? '' : 'disabled'}>
              <span class="mix-icon" aria-hidden="true">◎</span>
              <span><strong>Všechny produkty</strong><small>Otázky ze všech aktuálních i nově přidaných produktů.</small></span>
              <span class="mix-check" aria-hidden="true">✓</span>
            </button>
            <section class="scope-section" aria-labelledby="category-heading">
              <h3 id="category-heading">Kategorie</h3>
              <div class="type-options">
                ${categories.map((category) => {
                  const products = state.products.filter((product) => product.category === category);
                  const checked = products.every((product) => enabledProductSet.has(product.id));
                  return `<label class="type-option scope-option">
                    <span><strong>${escapeHtml(category)}</strong><small>${products.length} ${products.length === 1 ? 'produkt' : 'produkty'}</small></span>
                    <input type="checkbox" name="product-category" value="${escapeHtml(category)}" ${checked ? 'checked' : ''}>
                    <span class="switch" aria-hidden="true"></span>
                  </label>`;
                }).join('')}
              </div>
            </section>
            <section class="scope-section" aria-labelledby="product-heading">
              <h3 id="product-heading">Jednotlivé produkty</h3>
              <div class="type-options">
                ${state.products.map((product) => `<label class="type-option scope-option">
                  <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span>
                  <input type="checkbox" name="study-product" value="${product.id}" ${enabledProductSet.has(product.id) ? 'checked' : ''}>
                  <span class="switch" aria-hidden="true"></span>
                </label>`).join('')}
              </div>
            </section>
          </div>
        </details>
        <details class="settings-card collapsible-settings" id="archived-products-details">
          <summary>
            <span><strong>Vyřazené produkty</strong><small>${archived.length ? `${archived.length} ${archived.length === 1 ? 'produkt lze obnovit' : archived.length <= 4 ? 'produkty lze obnovit' : 'produktů lze obnovit'}` : 'Koš je prázdný'}</small></span>
            <span class="disclosure-icon" aria-hidden="true">⌄</span>
          </summary>
          <div class="collapsible-content">
            <p>Vyřazené produkty se nezobrazují v katalogu ani v testech. Pokrok a historie odpovědí zůstávají zachované.</p>
            <div class="archived-products-list">
              ${archived.length ? archived.map((product) => `
                <article class="archived-product">
                  <img src="${product.image}" alt="" width="64" height="64" loading="lazy">
                  <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)}</small></span>
                  <button class="button button-secondary restore-product" type="button" data-restore-product-id="${product.id}">Obnovit</button>
                </article>`).join('') : '<div class="empty-catalog"><strong>Žádné vyřazené produkty</strong><span>Vyřadit je můžete v detailu konkrétního produktu.</span></div>'}
            </div>
          </div>
        </details>
        <article class="settings-card">
          <div class="field-row"><div><h2>Vzhled</h2><p>Světlý, tmavý nebo podle telefonu.</p></div>
          <select id="theme" aria-label="Barevný režim"><option value="system">Podle telefonu</option><option value="light">Světlý</option><option value="dark">Tmavý</option></select></div>
        </article>
        <article class="settings-card"><h2>Záloha pokroku</h2><p>Soubor obsahuje váš profil, nastavení a nezměnitelnou historii opakování. Můžete ho rovnou sdílet do druhého telefonu a tam zvolit Importovat.</p>
          <div class="action-row"><button id="share-backup" class="button button-primary" type="button">Sdílet zálohu</button><button id="export" class="button button-secondary" type="button">Stáhnout</button><button id="import" class="button button-secondary" type="button">Importovat</button></div>
        </article>
        <article class="settings-card"><h2>Vstupní test</h2><p>${state.settings.baselineCompleted ? 'Vstupní test už proběhl. Kdykoli si ho můžete zopakovat bez smazání dosavadního pokroku.' : 'Krátký průřez kategoriemi pomůže nastavit první opakování.'}</p><button id="restart-baseline" class="button button-secondary" type="button">${state.settings.baselineCompleted ? 'Spustit znovu' : 'Spustit vstupní test'}</button></article>
        <article class="settings-card"><h2>Identita zařízení</h2><p>ID: <code>${escapeHtml(state.profile.userId)}</code></p><button id="edit-profile" class="button button-secondary" type="button">Upravit přezdívku</button></article>
      </div>
    </section>`;
  document.querySelector('#theme').value = state.settings.theme;
  document.querySelectorAll('[data-restore-product-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const product = state.catalogProducts.find((item) => item.id === button.dataset.restoreProductId);
      const archivedProductIds = (state.settings.archivedProductIds || []).filter((id) => id !== button.dataset.restoreProductId);
      state.settings = await storage.saveSettings({ archivedProductIds });
      refreshActiveContent();
      await updateBadge();
      renderSettings();
      showToast(`${product?.name || 'Produkt'} je znovu aktivní.`);
    });
  });
  document.querySelector('#new-limit').addEventListener('change', async (event) => {
    state.settings = await storage.saveSettings({ newCardsPerDay: Number(event.target.value) });
    showToast('Denní limit je uložený.');
  });
  document.querySelector('#session-minutes').addEventListener('change', async (event) => {
    state.settings = await storage.saveSettings({ sessionMinutes: Number(event.target.value) });
    showToast(`Trénink nastavený přibližně na ${event.target.value} minut.`);
  });
  document.querySelectorAll('input[name="question-type"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const enabledQuestionTypes = [...document.querySelectorAll('input[name="question-type"]:checked')].map((input) => input.value);
      if (!enabledQuestionTypes.length) {
        event.target.checked = true;
        showToast('Alespoň jeden typ otázky musí zůstat zapnutý.');
        return;
      }
      state.settings = await storage.saveSettings({ enabledQuestionTypes });
      document.querySelector('#mix-all').classList.toggle('is-active', enabledQuestionTypes.length === QUESTION_TYPE_SETTINGS.length);
      document.querySelector('#question-types-summary').textContent = describeQuestionTypes(enabledQuestionTypes);
      showToast('Typy otázek jsou uložené.');
    });
  });
  document.querySelector('#mix-all').addEventListener('click', async () => {
    const enabledQuestionTypes = QUESTION_TYPE_SETTINGS.map((type) => type.id);
    document.querySelectorAll('input[name="question-type"]').forEach((checkbox) => { checkbox.checked = true; });
    state.settings = await storage.saveSettings({ enabledQuestionTypes });
    document.querySelector('#mix-all').classList.add('is-active');
    document.querySelector('#question-types-summary').textContent = describeQuestionTypes(enabledQuestionTypes);
    showToast('Zapnutý mix všech typů.');
  });
  const syncProductScopeControls = () => {
    const selected = new Set([...document.querySelectorAll('input[name="study-product"]:checked')].map((input) => input.value));
    document.querySelector('#select-all-products').classList.toggle('is-active', state.products.length > 0 && selected.size === state.products.length);
    document.querySelector('#product-scope-summary').textContent = describeProductScope(selected.size);
    document.querySelectorAll('input[name="product-category"]').forEach((checkbox) => {
      const categoryProducts = state.products.filter((product) => product.category === checkbox.value);
      const selectedCount = categoryProducts.filter((product) => selected.has(product.id)).length;
      checkbox.checked = selectedCount === categoryProducts.length;
      checkbox.indeterminate = selectedCount > 0 && selectedCount < categoryProducts.length;
    });
  };
  const saveProductScope = async (message) => {
    const ids = [...document.querySelectorAll('input[name="study-product"]:checked')].map((input) => input.value);
    if (!ids.length) return false;
    state.settings = await storage.saveSettings({ enabledProductIds: ids.length === state.products.length ? null : ids });
    syncProductScopeControls();
    await updateBadge();
    showToast(message);
    return true;
  };
  document.querySelector('#select-all-products').addEventListener('click', async () => {
    document.querySelectorAll('input[name="study-product"]').forEach((checkbox) => { checkbox.checked = true; });
    await saveProductScope('Zapnuté zkoušení ze všech produktů.');
  });
  document.querySelectorAll('input[name="study-product"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      if (!await saveProductScope('Výběr produktů je uložený.')) {
        event.target.checked = true;
        syncProductScopeControls();
        showToast('Alespoň jeden produkt musí zůstat zapnutý.');
      }
    });
  });
  document.querySelectorAll('input[name="product-category"]').forEach((checkbox) => {
    checkbox.addEventListener('change', async (event) => {
      const categoryIds = state.products.filter((product) => product.category === event.target.value).map((product) => product.id);
      document.querySelectorAll('input[name="study-product"]').forEach((productCheckbox) => {
        if (categoryIds.includes(productCheckbox.value)) productCheckbox.checked = event.target.checked;
      });
      if (!await saveProductScope('Výběr kategorií je uložený.')) {
        categoryIds.forEach((id) => { document.querySelector(`input[name="study-product"][value="${id}"]`).checked = true; });
        syncProductScopeControls();
        showToast('Alespoň jedna kategorie nebo jeden produkt musí zůstat zapnutý.');
      }
    });
  });
  syncProductScopeControls();
  document.querySelector('#theme').addEventListener('change', async (event) => {
    state.settings = await storage.saveSettings({ theme: event.target.value });
    applyTheme(state.settings.theme);
  });
  document.querySelector('#export').addEventListener('click', exportBackup);
  document.querySelector('#share-backup').addEventListener('click', shareBackup);
  document.querySelector('#import').addEventListener('click', () => document.querySelector('#import-file').click());
  document.querySelector('#restart-baseline').addEventListener('click', startBaselineStudy);
  document.querySelector('#edit-profile').addEventListener('click', openProfileDialog);
}

function bindCommonActions() {
  app.querySelectorAll('[data-view-link]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.viewLink)));
  app.querySelectorAll('[data-product-id]').forEach((button) => button.addEventListener('click', () => openProduct(button.dataset.productId)));
}

function openProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  const allergens = product.allergens.length
    ? product.allergens.map((allergenId) => `<span class="allergen-chip">${ALLERGENS[allergenId]}</span>`).join('')
    : '<span class="allergen-none">Žádné z 14 povinně značených alergenů EU</span>';
  const productFacts = [
    product.brand && ['Značka', product.brand],
    product.manufacturer && ['Výrobce', product.manufacturer],
    product.origin && ['Původ', product.origin],
  ].filter(Boolean);
  const sources = (product.sources || []).map((source) => `
    <a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)} ↗</a>`).join('');
  const note = state.productNotes[product.id] || '';
  document.querySelector('#product-detail').innerHTML = `
    <div class="product-detail-media">
      <img class="product-detail-image" src="${product.image}" alt="${escapeHtml(product.name)}">
      <button class="dialog-close product-detail-close" type="button" aria-label="Zavřít detail produktu">×</button>
    </div>
    <div class="product-detail-body">
      <p class="eyebrow">${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2>
      ${product.description ? `<p class="product-description">${renderGlossaryText(product.description)}</p>` : ''}
      ${productFacts.length ? `<dl class="product-facts">${productFacts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
      <h3>Složení</h3><p>${product.ingredients.map(renderGlossaryText).join(', ')}</p>
      <h3>Alergeny</h3><div class="allergen-list">${allergens}</div>
      ${product.specifics?.length ? `<h3>Čím je produkt specifický</h3><ul>${product.specifics.map((item) => `<li>${renderGlossaryText(item)}</li>`).join('')}</ul>` : ''}
      <h3>Použití a uchování</h3><ol>${product.preparation.map((step) => `<li>${renderGlossaryText(step)}</li>`).join('')}</ol>
      ${product.brandInfo ? `<h3>O značce</h3><p>${renderGlossaryText(product.brandInfo)}</p>` : ''}
      <h3>Doporučení k prodeji</h3><p class="sales-tip">${renderGlossaryText(product.salesTip)}</p>
      <button id="study-product" class="button button-primary button-full" type="button">Procvičit tento produkt</button>
      ${sources ? `<h3>Zdroje informací</h3><div class="source-links">${sources}</div>` : ''}
      <form id="product-note-form" class="product-note-form">
        <label for="product-note">Moje poznámka</label>
        <p>Soukromá poznámka se uloží jen v tomto zařízení a zahrne se do zálohy.</p>
        <textarea id="product-note" name="note" maxlength="2000" rows="4" placeholder="Například umístění v regálu, tip od dodavatele nebo vlastní zkušenost…">${escapeHtml(note)}</textarea>
        <button class="button button-secondary button-full" type="submit">Uložit poznámku</button>
      </form>
      <div class="product-lifecycle-actions">
        <button id="archive-product" class="button button-danger button-full" type="button">Vyřadit produkt</button>
        <p>Produkt zmizí z katalogu a testů. Dosavadní pokrok se nesmaže a produkt půjde obnovit v Nastavení.</p>
      </div>
    </div>`;
  productDialog.querySelector('.dialog-close').addEventListener('click', () => productDialog.close());
  productDialog.querySelectorAll('[data-glossary-id]').forEach((button) => {
    button.addEventListener('click', () => openGlossary(button.dataset.glossaryId));
  });
  productDialog.querySelector('#product-note-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = await storage.saveProductNote(product.id, new FormData(event.currentTarget).get('note'));
    if (value) state.productNotes[product.id] = value;
    else delete state.productNotes[product.id];
    showToast(value ? 'Poznámka je uložená.' : 'Poznámka je odstraněná.');
  });
  productDialog.querySelector('#study-product').addEventListener('click', () => {
    const queue = buildTopicStudyQueue({
      ...state,
      enabledQuestionTypes: state.settings.enabledQuestionTypes,
      enabledProductIds: [product.id],
      limit: sessionQuestionLimit(),
    });
    if (!queue.length) {
      showToast('Pro tento produkt nejsou ve vybraných typech dostupné otázky.');
      return;
    }
    productDialog.close();
    startStudySession(queue, 'product');
  });
  productDialog.querySelector('#archive-product').addEventListener('click', async () => {
    if (!window.confirm(`Opravdu vyřadit produkt „${product.name}“? Pokrok zůstane zachovaný.`)) return;
    const archivedProductIds = [...new Set([...(state.settings.archivedProductIds || []), product.id])];
    state.settings = await storage.saveSettings({ archivedProductIds });
    refreshActiveContent();
    productDialog.close();
    await updateBadge();
    navigate(state.currentView === 'study' ? 'products' : state.currentView);
    showToast('Produkt je vyřazený. Obnovit ho můžete v Nastavení.');
  });
  productDialog.showModal();
}

function startStudy() {
  const queue = buildStudyQueue({
    ...state,
    newCardsPerDay: state.settings.newCardsPerDay,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  if (!queue.length) return;
  startStudySession(queue, 'daily');
}

function baselineQuestions() {
  const enabledProducts = new Set(selectedProductIds());
  const enabledTypes = new Set(state.settings.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  const products = shuffledCopy(state.products.filter((product) => enabledProducts.has(product.id)));
  const categoryOrder = shuffledCopy([...new Set(products.map((product) => product.category))]);
  const categorySamples = categoryOrder.map((category) => products.find((product) => product.category === category)).filter(Boolean);
  const sampledIds = new Set(categorySamples.map((product) => product.id));
  const orderedProducts = [...categorySamples, ...products.filter((product) => !sampledIds.has(product.id))];
  const candidates = orderedProducts.map((product) => {
    const questions = state.questions.filter((question) => question.productId === product.id && enabledTypes.has(question.type));
    return questions.find((question) => question.type === 'mcq')
      || questions.find((question) => question.type === 'photo')
      || questions.find((question) => question.type === 'text')
      || questions[0];
  }).filter(Boolean);
  return [...new Map(candidates.map((question) => [question.productId, question])).values()].slice(0, sessionQuestionLimit());
}

function startBaselineStudy() {
  const queue = baselineQuestions();
  if (!queue.length) {
    showToast('Pro vstupní test nejsou dostupné otázky.');
    return;
  }
  startStudySession(queue, 'baseline');
}

function startWeakStudy(queue = null) {
  const weakQueue = queue || buildWeakStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  if (!weakQueue.length) {
    showToast('Teď nemáte žádná výrazná slabá místa.');
    return;
  }
  startStudySession(weakQueue, 'weak');
}

function startRecognitionStudy() {
  const limit = sessionQuestionLimit();
  const enabledProducts = new Set(selectedProductIds());
  const available = photoChallengeQuestions().filter((question) => enabledProducts.has(question.productId));
  const groups = shuffledCopy([...new Set(available.map((question) => question.productId))]).slice(0, Math.ceil(limit / 2));
  const queue = groups.flatMap((productId) => shuffledCopy(available.filter((question) => question.productId === productId)).slice(0, 2));
  if (queue.length < limit) {
    const selectedIds = new Set(queue.map((question) => question.id));
    queue.push(...shuffledCopy(available.filter((question) => !selectedIds.has(question.id))).slice(0, limit - queue.length));
  }
  if (!queue.length) {
    showToast('Pro vybrané produkty nejsou dostupné fotografické otázky.');
    return;
  }
  startStudySession(queue, 'recognition');
}

function categoryFamily(category) {
  const value = normalizeText(category);
  const groups = [
    ['kava', 'kavove'],
    ['sirup', 'sladid', 'cukr'],
    ['syr', 'jogurt', 'mlecne'],
    ['olej', 'oct', 'omack', 'ochucovad', 'koreni', 'sul'],
    ['testovin', 'mouka'],
    ['gran', 'musli', 'kase', 'susene ovoce'],
    ['vino', 'lihovin'],
    ['vejce', 'maso', 'uzenin', 'pastik'],
    ['caj', 'napoj'],
  ];
  return groups.findIndex((keywords) => keywords.some((keyword) => value.includes(keyword)));
}

function createCategoryPhotoChallenge(photoQuestion) {
  const product = state.products.find((item) => item.id === photoQuestion.productId);
  if (!product) return null;
  const family = categoryFamily(product.category);
  const categories = [...new Set(state.products.map((item) => item.category))]
    .filter((category) => category !== product.category)
    .sort((a, b) => Number(categoryFamily(b) === family) - Number(categoryFamily(a) === family) || a.localeCompare(b, 'cs'));
  return {
    ...photoQuestion,
    format: 'photo-challenge',
    prompt: 'Do které kategorie tento produkt patří?',
    options: [product.category, ...categories.slice(0, 3)],
    answer: product.category,
    explanation: `Produkt je v katalogu zařazený v kategorii ${product.category}.`,
  };
}

function createManufacturerPhotoChallenge(question) {
  const product = state.products.find((item) => item.id === question.productId);
  if (!product || !Array.isArray(question.options)) return null;
  return {
    ...question,
    type: 'photo',
    format: 'photo-challenge',
    image: product.image,
    prompt: 'Kdo tento produkt vyrábí?',
  };
}

function createPropertyPhotoChallenge(question) {
  const product = state.products.find((item) => item.id === question.productId);
  if (!product || typeof question.answer !== 'string') return null;
  const family = categoryFamily(product.category);
  const candidates = state.questions.filter((item) => item.id !== question.id
    && item.type === 'flashcard'
    && item.sourceUrl
    && typeof item.answer === 'string'
    && !/na jaký sortiment|na jakou tradici/i.test(item.prompt))
    .sort((a, b) => {
      const aProduct = state.products.find((item) => item.id === a.productId);
      const bProduct = state.products.find((item) => item.id === b.productId);
      return Number(categoryFamily(bProduct?.category || '') === family) - Number(categoryFamily(aProduct?.category || '') === family);
    });
  const distractors = [...new Set(candidates.map((item) => item.answer).filter((answer) => answer !== question.answer))].slice(0, 3);
  if (distractors.length < 3) return null;
  return {
    ...question,
    type: 'photo',
    format: 'photo-challenge',
    image: product.image,
    prompt: 'Které tvrzení o tomto produktu je správné?',
    options: [question.answer, ...distractors],
  };
}

function photoChallengeQuestions() {
  const challenges = [];
  for (const product of state.products) {
    const questions = state.questions.filter((question) => question.productId === product.id);
    const photo = questions.find((question) => question.type === 'photo');
    if (photo) challenges.push(createCategoryPhotoChallenge(photo));
    const manufacturer = questions.find((question) => question.type === 'mcq' && question.sourceUrl && /který výrobce stojí za produktem/i.test(question.prompt));
    if (manufacturer) challenges.push(createManufacturerPhotoChallenge(manufacturer));
    const property = questions.find((question) => question.type === 'flashcard' && question.sourceUrl && !/na jaký sortiment|na jakou tradici/i.test(question.prompt));
    if (property) challenges.push(createPropertyPhotoChallenge(property));
  }
  return challenges.filter(Boolean);
}

function comparisonQuestions() {
  const enabledProducts = new Set(selectedProductIds());
  const productsById = new Map(state.products.map((product) => [product.id, product]));
  const propertyQuestions = state.questions.filter((question) => enabledProducts.has(question.productId)
    && question.type === 'flashcard'
    && question.sourceUrl
    && typeof question.answer === 'string'
    && !/na jaký sortiment|na jakou tradici/i.test(question.prompt));
  return propertyQuestions.map((question) => {
    const target = productsById.get(question.productId);
    if (!target) return null;
    const family = categoryFamily(target.category);
    const automaticComparisons = state.products
      .filter((product) => product.id !== target.id
        && enabledProducts.has(product.id)
        && (product.category === target.category || (family >= 0 && categoryFamily(product.category) === family)))
      .sort((a, b) => Number(b.category === target.category) - Number(a.category === target.category));
    const comparisonProductIds = [question.productId, ...(question.comparisonWith || []), ...automaticComparisons.map((product) => product.id)]
      .filter((id, index, values) => enabledProducts.has(id) && productsById.has(id) && values.indexOf(id) === index)
      .slice(0, 4);
    if (comparisonProductIds.length < 2) return null;
    return {
      ...question,
      type: 'mcq',
      format: 'comparison',
      prompt: `Ke kterému produktu patří údaj „${question.answer}“?`,
      options: comparisonProductIds.map((id) => productsById.get(id).name),
      answer: target.name,
      explanation: `${target.name}: ${question.explanation}`,
      comparisonProductIds,
    };
  }).filter(Boolean);
}

function startComparisonStudy() {
  const queue = shuffledCopy(comparisonQuestions()).slice(0, sessionQuestionLimit());
  if (!queue.length) {
    showToast('Pro aktuální výběr produktů nejsou dostupná porovnání.');
    return;
  }
  startStudySession(queue, 'comparison');
}

function scenarioQuestions() {
  const enabledProducts = new Set(selectedProductIds());
  const enabledTypes = new Set(state.settings.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  const eligible = state.questions.filter((question) => enabledProducts.has(question.productId)
    && enabledTypes.has(question.type)
    && question.type !== 'photo'
    && /alergen|složen|obsahuje|příprav|připrav|servír|použit|výrobc|značk|specif|doporuč|prodej/i.test(question.prompt));
  return eligible.map((question) => {
    const prompt = /alergen|složen|obsahuje/i.test(question.prompt)
      ? `Zákazník se ptá na složení a alergeny. ${question.prompt}`
      : /příprav|připrav|servír|použit/i.test(question.prompt)
        ? `Kolega potřebuje poradit s přípravou nebo použitím. ${question.prompt}`
        : `Zákazník se rozhoduje u regálu. ${question.prompt}`;
    return { ...question, format: 'scenario', prompt };
  });
}

function startScenarioStudy() {
  const candidates = shuffledCopy(scenarioQuestions());
  const byProduct = new Map();
  for (const question of candidates) {
    if (!byProduct.has(question.productId)) byProduct.set(question.productId, question);
  }
  const diverse = [...byProduct.values(), ...candidates.filter((question) => ![...byProduct.values()].includes(question))];
  const queue = diverse.slice(0, sessionQuestionLimit());
  if (!queue.length) {
    showToast('Pro aktuální výběr nejsou dostupné situační otázky.');
    return;
  }
  startStudySession(queue, 'scenario');
}

function openTopicDialog() {
  const enabledProductIds = new Set(selectedProductIds());
  const enabledQuestionTypes = new Set(state.settings.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  const categories = [...new Set(state.products.filter((product) => enabledProductIds.has(product.id)).map((product) => product.category))];
  const options = categories.map((category) => {
    const products = state.products.filter((product) => product.category === category && enabledProductIds.has(product.id));
    const productIds = new Set(products.map((product) => product.id));
    const questionCount = state.questions.filter((question) => productIds.has(question.productId) && enabledQuestionTypes.has(question.type)).length;
    return { category, products, questionCount };
  }).filter((item) => item.questionCount > 0);

  document.querySelector('#topic-options').innerHTML = options.length ? options.map((item) => `
    <button class="topic-option" type="button" data-topic="${escapeHtml(item.category)}">
      <span><strong>${escapeHtml(item.category)}</strong><small>${item.products.length} ${item.products.length === 1 ? 'produkt' : item.products.length <= 4 ? 'produkty' : 'produktů'} · ${item.questionCount} otázek</small></span>
      <span aria-hidden="true">→</span>
    </button>`).join('') : '<div class="empty-catalog"><strong>Žádné dostupné téma</strong><span>V Nastavení nejdřív zapněte alespoň jeden produkt.</span></div>';

  topicDialog.querySelectorAll('[data-topic]').forEach((button) => {
    button.addEventListener('click', () => startTopicStudy(button.dataset.topic));
  });
  topicDialog.showModal();
}

function startTopicStudy(category) {
  const enabledProducts = new Set(selectedProductIds());
  const categoryProductIds = state.products
    .filter((product) => product.category === category && enabledProducts.has(product.id))
    .map((product) => product.id);
  const queue = buildTopicStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: categoryProductIds,
    limit: sessionQuestionLimit(),
  });
  if (!queue.length) {
    showToast('Pro toto téma nejsou dostupné otázky.');
    return;
  }
  topicDialog.close();
  startStudySession(queue, 'topic');
}

function startStudySession(queue, mode) {
  const preparedQueue = limitedQueue(queue).map((question) => question.type === 'photo' && question.format !== 'photo-challenge' ? createCategoryPhotoChallenge(question) : question).filter(Boolean);
  state.session = { queue: preparedQueue, index: 0, answers: [], revealed: false, retryIds: new Set(), optionOrders: new Map(), mascotQuizShows: 0, mode };
  state.currentView = 'study';
  document.body.classList.add('is-studying');
  setActiveNav('');
  renderQuestion();
}

function currentQuestion() { return state.session?.queue[state.session.index]; }

function shuffledOptions(question) {
  if (!Array.isArray(question.options)) return [];
  if (state.session.optionOrders.has(question.id)) return state.session.optionOrders.get(question.id);
  const options = [...question.options];
  for (let index = options.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
  }
  state.session.optionOrders.set(question.id, options);
  return options;
}

function comparisonPreview(question) {
  if (question.format !== 'comparison') return '';
  const productsById = new Map(state.products.map((product) => [product.id, product]));
  return `<div class="compare-products" aria-label="Porovnávané produkty">${question.comparisonProductIds.map((id) => {
    const product = productsById.get(id);
    return `<div class="compare-product"><img src="${product.image}" alt=""><span>${escapeHtml(product.name)}</span></div>`;
  }).join('')}</div>`;
}

function memorableSpecific(product) {
  return product.specifics?.find((item) => !/^(?:cca\s*)?\d+[,.]?\d*\s*(?:g|kg|ml|l|ks|kusů|sáčků|kapslí)\b/i.test(item) && !/^ean\b/i.test(item)) || product.specifics?.[0];
}

function memoryDetails(question) {
  const product = state.products.find((item) => item.id === question.productId);
  if (!product) return '';
  const facts = [
    ['Výrobce', product.manufacturer],
    ['Kategorie', product.category],
    ['Hlavní údaj', memorableSpecific(product)],
  ].filter(([, value]) => value);
  return `<details class="memory-details"><summary>Zapamatovat si <span aria-hidden="true">⌄</span></summary><dl class="recognition-facts">${facts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl></details>`;
}

function renderQuestion() {
  hideBistrous();
  const question = currentQuestion();
  if (!question) return renderSummary();
  state.session.revealed = false;
  const product = state.products.find((item) => item.id === question.productId);
  const image = question.type === 'photo' ? `<img class="question-image" src="${question.image}" alt="Produkt k poznání">` : '';
  const productHint = question.type === 'photo' ? 'Název na obalu není odpověď' : question.format === 'comparison' ? 'Podobné produkty' : product.name;
  const typeLabel = question.format === 'comparison' ? 'Porovnání' : question.format === 'scenario' ? 'Situace z bistra' : TYPE_LABELS[question.type];
  const progressPercent = (state.session.index / state.session.queue.length) * 100;
  const brainHeat = progressPercent < 34 ? 'Mozek se rozehřívá' : progressPercent < 75 ? 'Mozek zahřátý' : 'Mozek jede naplno';
  let control = '';
  if (question.type === 'mcq' || question.type === 'photo') {
    control = `<div class="options">${shuffledOptions(question).map((option) => `<button class="option" type="button" data-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>`;
  } else if (question.type === 'text') {
    control = `<form id="text-form"><input class="text-answer" name="answer" autocomplete="off" required placeholder="Napište odpověď…" aria-label="Vaše odpověď"><button class="button button-primary button-full">Zkontrolovat</button></form>`;
  } else {
    control = `<button id="reveal" class="button button-primary button-full" type="button">Ukázat odpověď</button>`;
  }
  app.innerHTML = `<section class="page study-page">
    <div class="study-toolbar"><button id="close-study" class="icon-button" type="button" aria-label="Ukončit trénink">×</button>
      <div class="study-progress"><div class="progress-track"><span style="width:${progressPercent}%"></span></div><small>${brainHeat}</small></div>
      <span class="study-counter">${state.session.index + 1}/${state.session.queue.length}</span></div>
    <article class="study-card">${question.isRecovery ? '<p class="recovery-context">Krátké srovnání po chybě — nejdřív si upevněte souvislost, potom přijde kontrolní otázka.</p>' : ''}<div class="question-meta"><span class="type-pill">${typeLabel}</span><span>${escapeHtml(productHint)}</span></div>
      ${image}${comparisonPreview(question)}<h1>${escapeHtml(question.prompt)}</h1><div id="answer-area">${control}</div><div id="feedback"></div>
    </article></section>`;
  document.querySelector('#close-study').addEventListener('click', () => navigate('home'));
  document.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => answerChoice(button.dataset.option)));
  document.querySelector('#text-form')?.addEventListener('submit', (event) => { event.preventDefault(); answerText(new FormData(event.currentTarget).get('answer')); });
  document.querySelector('#reveal')?.addEventListener('click', revealFlashcard);
  window.scrollTo({ top: 0, behavior: 'instant' });
  app.focus();
}

function questionSourceLink(question) {
  if (!question?.sourceUrl) return '';
  const label = question.sourceLabel || 'Zdroj výrobce';
  return `<a class="answer-source" href="${escapeHtml(question.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
}

function bistrousAchievement(correct, previousReviews) {
  if (!correct || state.session.mascotQuizShows >= 1) return null;
  const recovered = previousReviews.some((review) => review.rating <= RATINGS.HARD);
  let correctRun = 0;
  for (let index = state.session.answers.length - 1; index >= 0 && state.session.answers[index].correct; index -= 1) correctRun += 1;
  if (recovered) {
    state.session.mascotQuizShows += 1;
    return randomBistrousLine('recovery');
  }
  if (correctRun === 4) {
    state.session.mascotQuizShows += 1;
    return randomBistrousLine('streak');
  }
  return null;
}

function showFeedback({ correct, selected, answer, explanation, question, mascotLine }) {
  const panel = document.querySelector('#feedback');
  const answerValue = Array.isArray(answer) ? answer.join(', ') : answer;
  const answerSummary = correct
    ? `<div class="result-answer result-answer-correct"><span>Správná odpověď</span><strong>${escapeHtml(answerValue)}</strong></div>`
    : `<div class="answer-comparison"><div class="result-answer result-answer-wrong"><span>Vaše odpověď</span><strong>${escapeHtml(selected || 'Bez odpovědi')}</strong></div><div class="result-answer result-answer-correct"><span>Správná odpověď</span><strong>${escapeHtml(answerValue)}</strong></div></div>`;
  panel.innerHTML = `<section class="result-card ${correct ? 'is-correct' : 'is-wrong'}" role="status">
    <div class="result-heading"><span class="result-icon" aria-hidden="true">${correct ? '✓' : '×'}</span><div><small>Výsledek</small><strong>${correct ? 'Správně' : 'Zatím ne'}</strong></div></div>
    ${answerSummary}
    <div class="result-explanation"><strong>Proč?</strong><p>${escapeHtml(explanation)}</p></div>
    ${memoryDetails(question)}${questionSourceLink(question)}
  </section><button id="next" class="button button-primary button-full result-next" type="button">Pokračovat</button>`;
  document.querySelector('#next').addEventListener('click', nextQuestion);
  if (mascotLine) showBistrousMoment('quiz', mascotLine, 3300, 'right');
}

async function answerChoice(selected) {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const correct = selected === question.answer;
  document.querySelectorAll('.option').forEach((button) => {
    button.disabled = true;
    const isAnswer = button.dataset.option === question.answer;
    const isSelectedWrong = button.dataset.option === selected && !correct;
    if (isAnswer) {
      button.classList.add('is-correct');
      button.setAttribute('aria-label', `${button.textContent} – správná odpověď`);
    } else if (isSelectedWrong) {
      button.classList.add('is-wrong');
      button.setAttribute('aria-label', `${button.textContent} – vaše chybná odpověď`);
    } else {
      button.classList.add('is-dimmed');
    }
  });
  const mascotLine = await recordReview(question, correct ? RATINGS.GOOD : RATINGS.AGAIN, correct, selected);
  showFeedback({ correct, selected, answer: question.answer, explanation: question.explanation, question, mascotLine });
}

async function answerText(input) {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const result = evaluateText(input, question.answer);
  document.querySelector('#text-form').querySelectorAll('input,button').forEach((element) => { element.disabled = true; });
  const mascotLine = await recordReview(question, result.correct ? RATINGS.GOOD : RATINGS.AGAIN, result.correct, input);
  showFeedback({ correct: result.correct, selected: input, answer: question.answerDisplay || (Array.isArray(question.answer) ? question.answer.join(', ') : question.answer), explanation: question.explanation, question, mascotLine });
}

function revealFlashcard() {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const intervals = getIntervals(state.progress[question.id]);
  document.querySelector('#answer-area').innerHTML = `<section class="result-card is-revealed">
    <div class="result-heading"><span class="result-icon" aria-hidden="true">→</span><div><small>Kartička</small><strong>Odpověď</strong></div></div>
    <div class="result-answer result-answer-correct"><span>Správná odpověď</span><strong>${escapeHtml(question.answer)}</strong></div>
    <div class="result-explanation"><strong>Proč?</strong><p>${escapeHtml(question.explanation)}</p></div>
    ${memoryDetails(question)}${questionSourceLink(question)}</section>
    <p class="rating-question">Jak dobře jste si vzpomněli?</p>
    <div class="rating-grid">${[RATINGS.AGAIN, RATINGS.HARD, RATINGS.GOOD, RATINGS.EASY].map((rating) => `<button class="rating ${rating === RATINGS.AGAIN ? 'rating-again' : rating === RATINGS.EASY ? 'rating-easy' : ''}" type="button" data-rating="${rating}">${ratingLabel(rating)}<small>${formatInterval(intervals[rating])}</small></button>`).join('')}</div>`;
  document.querySelectorAll('[data-rating]').forEach((button) => button.addEventListener('click', async () => {
    document.querySelectorAll('[data-rating]').forEach((item) => { item.disabled = true; });
    const rating = Number(button.dataset.rating);
    const mascotLine = await recordReview(question, rating, rating >= RATINGS.GOOD, null);
    const hasAnotherQuestion = state.session.index + 1 < state.session.queue.length;
    nextQuestion();
    if (mascotLine && hasAnotherQuestion) showBistrousMoment('quiz', mascotLine, 3300, 'right');
  }));
}

function formatInterval(date) {
  const minutes = Math.max(1, Math.round((new Date(date) - new Date()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

async function recordReview(question, rating, correct, selectedAnswer = null) {
  const canonicalQuestionId = question.sourceQuestionId || question.id;
  const previousReviews = state.reviews.filter((review) => review.questionId === canonicalQuestionId);
  const wasNew = previousReviews.length === 0;
  const review = {
    id: crypto.randomUUID(), userId: state.profile.userId, questionId: canonicalQuestionId,
    productId: question.productId,
    rating,
    wasCorrect: Boolean(correct),
    selectedAnswer: selectedAnswer == null ? null : String(selectedAnswer),
    correctAnswer: String(question.answerDisplay || (Array.isArray(question.answer) ? question.answer.join(', ') : question.answer)),
    mode: state.session.mode,
    reviewedAt: new Date().toISOString(),
    wasNew,
  };
  await storage.appendReview(review);
  state.reviews.push(review);
  const history = state.reviews.filter((item) => item.questionId === canonicalQuestionId);
  state.progress[canonicalQuestionId] = rebuildProgress(history);
  await storage.saveQuestionProgress(canonicalQuestionId, state.progress[canonicalQuestionId]);
  state.session.answers.push({ questionId: canonicalQuestionId, productId: question.productId, correct, rating });
  if (rating <= RATINGS.HARD && !question.isRecovery && !question.isRecoveryCheck && !state.session.retryIds.has(canonicalQuestionId)) {
    const comparison = comparisonQuestions().find((item) => item.productId === question.productId && item.id !== canonicalQuestionId);
    const related = comparison
      ? { ...comparison, id: `recovery-${canonicalQuestionId}-${comparison.id}`, sourceQuestionId: comparison.id, isRecovery: true }
      : state.questions.find((item) => item.productId === question.productId && item.id !== canonicalQuestionId && questionIsEnabled(item));
    const recoveryQuestion = related && !related.isRecovery ? { ...related, isRecovery: true } : related;
    const comparisonAt = Math.min(state.session.queue.length, state.session.index + 2);
    if (recoveryQuestion) state.session.queue.splice(comparisonAt, 0, recoveryQuestion);
    const checkAt = Math.min(state.session.queue.length, state.session.index + (recoveryQuestion ? 4 : 3));
    state.session.queue.splice(checkAt, 0, { ...question, id: `check-${canonicalQuestionId}`, sourceQuestionId: canonicalQuestionId, isRecoveryCheck: true });
    state.session.retryIds.add(canonicalQuestionId);
  }
  return bistrousAchievement(correct, previousReviews);
}

function nextQuestion() {
  state.session.index += 1;
  renderQuestion();
}

function renderSummary() {
  hideBistrous();
  const answers = state.session.answers;
  const correct = answers.filter((item) => item.correct).length;
  const accuracy = answers.length ? Math.round(correct / answers.length * 100) : 0;
  const misses = Object.entries(answers.filter((item) => !item.correct).reduce((acc, item) => ({ ...acc, [item.productId]: (acc[item.productId] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const problem = misses.length ? state.products.find((product) => product.id === misses[0][0])?.name : 'Žádný — skvělá práce';
  const lastAnswerByQuestion = new Map(answers.map((item) => [item.questionId, item]));
  const missedQuestionIds = new Set([...lastAnswerByQuestion.values()].filter((item) => !item.correct).map((item) => item.questionId));
  const retryQueue = [...new Map(state.session.queue.filter((question) => missedQuestionIds.has(question.id)).map((question) => [question.id, question])).values()];
  const missedProducts = misses.slice(0, 3).map(([productId, count]) => {
    const product = state.products.find((item) => item.id === productId);
    return `<li><span>${escapeHtml(product?.name || productId)}</span><strong>${count}×</strong></li>`;
  }).join('');
  const summaryLabel = state.session.mode === 'recognition' ? 'Foto výzva dokončena'
    : state.session.mode === 'comparison' ? 'Porovnávání dokončeno'
    : state.session.mode === 'scenario' ? 'Situace z bistra dokončeny'
    : state.session.mode === 'baseline' ? 'Vstupní test dokončen'
    : 'Dávka dokončena';
  const achievement = accuracy === 100 ? 'Pán etikety' : accuracy >= 80 ? 'Postrach regálů' : accuracy >= 60 ? 'Krotitel sortimentu' : 'Vytrvalý ochutnávač';
  const dailyGoalCompleted = state.session.mode === 'daily';
  if (state.session.mode === 'baseline' && !state.settings.baselineCompleted) {
    state.settings = { ...state.settings, baselineCompleted: true };
    storage.saveSettings({ baselineCompleted: true });
  }
  app.innerHTML = `<section class="page study-page"><article class="summary-card"><div class="summary-icon">✓</div><p class="eyebrow">${summaryLabel}</p><h1>Dobrá práce, ${escapeHtml(state.profile.nickname)}.</h1><p>Každé vybavení odpovědi posílilo paměťovou stopu.</p>
    <div class="achievement-badge"><span aria-hidden="true">★</span><div><small>Dnešní titul</small><strong>${achievement}</strong></div></div>
    <div class="summary-stats"><div><strong>${accuracy} %</strong><span>úspěšnost</span></div><div><strong>${correct}/${answers.length}</strong><span>správně</span></div><div><strong>${tomorrowCount()}</strong><span>do zítřka</span></div></div>
    ${misses.length ? `<div class="missed-review"><strong>Co ještě upevnit</strong><ul>${missedProducts}</ul></div>` : `<div class="answer-panel" style="text-align:left"><strong>Produkt k procvičení</strong><p>${escapeHtml(problem)}</p></div>`}
    ${retryQueue.length ? `<button id="retry-mistakes" class="button button-secondary button-full" style="margin-top:.7rem" type="button">Zopakovat chybné otázky · ${retryQueue.length}</button>` : ''}
    ${misses.length ? '<button id="open-stats" class="button button-secondary button-full" style="margin-top:.7rem" type="button">Zobrazit slabá místa</button>' : ''}
    <button id="finish" class="button button-primary button-full" style="margin-top:1rem" type="button">Zpět na dnešek</button></article></section>`;
  document.querySelector('#finish').addEventListener('click', () => navigate('home'));
  document.querySelector('#open-stats')?.addEventListener('click', () => navigate('stats'));
  document.querySelector('#retry-mistakes')?.addEventListener('click', () => startStudySession(retryQueue, 'mistakes'));
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateBadge();
  if (dailyGoalCompleted) showBistrousMoment('goal', randomBistrousLine('goal'), 4800);
}

function openProfileDialog(force = false) {
  const input = document.querySelector('#nickname');
  input.value = state.profile?.nickname || '';
  profileDialog.dataset.force = String(force);
  profileDialog.querySelector('.dialog-close').hidden = force;
  profileDialog.showModal();
  setTimeout(() => input.focus(), 50);
}

async function exportBackup() {
  const payload = await storage.exportData();
  const file = new File([JSON.stringify(payload, null, 2)], `bistro-pokrok-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Záloha je stažená.');
}

async function shareBackup() {
  const payload = await storage.exportData();
  const file = new File([JSON.stringify(payload, null, 2)], `bistro-pokrok-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  if (!navigator.share || (navigator.canShare && !navigator.canShare({ files: [file] }))) {
    await exportBackup();
    showToast('Sdílení souborů tu není dostupné. Záloha se stáhla.');
    return;
  }
  try {
    await navigator.share({ title: 'Bistro do hlavy – záloha pokroku', text: 'Na druhém zařízení soubor načtěte v Nastavení → Importovat.', files: [file] });
  } catch (error) {
    if (error.name !== 'AbortError') showToast('Zálohu se nepodařilo sdílet.');
  }
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text());
    await storage.importData(payload);
    await loadState();
    navigate('home');
    showToast('Záloha je obnovená.');
  } catch (error) {
    showToast(error.message || 'Zálohu se nepodařilo načíst.');
  }
}

async function loadState() {
  const [{ products, questions, pendingProducts }, profile, reviews, settings, productNotes] = await Promise.all([
    contentProvider.getAll(), storage.getProfile(), storage.getReviews(), storage.getSettings(), storage.getProductNotes(),
  ]);
  Object.assign(state, { catalogProducts: products, catalogQuestions: questions, pendingProducts, profile, reviews, settings, productNotes });
  refreshActiveContent();
  state.progress = buildProgressFromReviews(questions, reviews);
  applyTheme(settings.theme);
  updateProfileChip();
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloadingForUpdate = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
    const checkForUpdate = () => registration.update().catch((error) => console.warn('Kontrola aktualizace se nezdařila.', error));

    checkForUpdate();
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
        if (state.profile && state.currentView !== 'study') showToast(randomBistrousLine('return'));
      }
    });
  } catch (error) {
    console.warn('Offline režim se nepodařilo zapnout.', error);
  }
}

document.querySelectorAll('.bottom-nav [data-view-link], .topbar [data-view-link]').forEach((button) => button.addEventListener('click', () => navigate(button.dataset.viewLink)));
document.querySelector('#profile-button').addEventListener('click', () => openProfileDialog(false));
profileDialog.querySelector('.dialog-close').addEventListener('click', () => profileDialog.close());
document.querySelector('#profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nickname = new FormData(event.currentTarget).get('nickname').trim();
  if (!nickname) return;
  const profile = state.profile || { userId: crypto.randomUUID(), createdAt: new Date().toISOString() };
  state.profile = await storage.saveProfile({ ...profile, nickname, updatedAt: new Date().toISOString() });
  updateProfileChip();
  profileDialog.close();
  navigate(state.currentView === 'study' ? 'home' : state.currentView);
});
profileDialog.addEventListener('cancel', (event) => { if (profileDialog.dataset.force === 'true') event.preventDefault(); });
productDialog.addEventListener('click', (event) => { if (event.target === productDialog) productDialog.close(); });
topicDialog.querySelector('.dialog-close').addEventListener('click', () => topicDialog.close());
topicDialog.addEventListener('click', (event) => { if (event.target === topicDialog) topicDialog.close(); });
glossaryDialog.querySelector('.dialog-close').addEventListener('click', () => glossaryDialog.close());
glossaryDialog.addEventListener('click', (event) => { if (event.target === glossaryDialog) glossaryDialog.close(); });
glossaryDialog.addEventListener('close', () => {
  const target = glossaryDialog.returnFocusTarget;
  if (!(target instanceof HTMLElement)) return;
  target.classList.add('is-return-focus');
  target.addEventListener('blur', () => target.classList.remove('is-return-focus'), { once: true });
  requestAnimationFrame(() => {
    if (document.activeElement !== target) target.classList.remove('is-return-focus');
  });
  glossaryDialog.returnFocusTarget = null;
});
document.querySelector('#import-file').addEventListener('change', (event) => { if (event.target.files[0]) importBackup(event.target.files[0]); event.target.value = ''; });
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (state.settings?.theme === 'system') applyTheme('system');
});

try {
  await loadState();
  renderHome();
  if (!state.profile) openProfileDialog(true);
  updateBadge();
  registerServiceWorker();
} catch (error) {
  console.error(error);
  app.innerHTML = `<section class="empty-state"><div><h1>Aplikaci se nepodařilo načíst</h1><p>Zkontrolujte připojení při prvním spuštění a zkuste stránku obnovit.</p><button class="button button-primary" onclick="location.reload()">Načíst znovu</button></div></section>`;
}
