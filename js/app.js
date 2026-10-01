import { CONFIG } from '../config.js?v=1.0.21';
import { contentProvider } from '../content.js?v=1.0.21';
import { storage } from '../storage.js?v=1.0.21';
import { RATINGS, getIntervals, rebuildProgress } from '../fsrs-service.js?v=1.0.21';
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
  ratingLabel,
} from '../study.js?v=1.0.21';

const ALLERGENS = {
  1: 'Obiloviny s lepkem', 2: 'Korýši', 3: 'Vejce', 4: 'Ryby', 5: 'Arašídy',
  6: 'Sójové boby', 7: 'Mléko', 8: 'Skořápkové plody', 9: 'Celer', 10: 'Hořčice',
  11: 'Sezam', 12: 'Oxid siřičitý a siřičitany', 13: 'Vlčí bob', 14: 'Měkkýši',
};

const TYPE_LABELS = { mcq: 'Výběr', flashcard: 'Kartička', text: 'Napsat', photo: 'Fotka' };
const QUESTION_TYPE_SETTINGS = [
  { id: 'mcq', label: 'Výběr z možností', description: 'Jedna správná odpověď ze čtyř.' },
  { id: 'flashcard', label: 'Kartičky', description: 'Odpověď si vybavíte a sami ohodnotíte.' },
  { id: 'text', label: 'Napsat odpověď', description: 'Odpověď napíšete vlastními slovy.' },
  { id: 'photo', label: 'Poznat z fotky', description: 'Produkt určíte podle fotografie.' },
];
const state = {
  catalogProducts: [], catalogQuestions: [], products: [], questions: [], reviews: [], progress: {}, profile: null, settings: null,
  currentView: 'home', session: null,
};

const app = document.querySelector('#app');
const profileDialog = document.querySelector('#profile-dialog');
const productDialog = document.querySelector('#product-dialog');
const topicDialog = document.querySelector('#topic-dialog');
const toast = document.querySelector('#toast');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
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
  state.currentView = view;
  state.session = view === 'study' ? state.session : null;
  setActiveNav(view);
  if (view === 'home') renderHome();
  if (view === 'products') renderProducts();
  if (view === 'stats') renderStats();
  if (view === 'settings') renderSettings();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function productRows(limit = state.products.length) {
  return state.products.slice(0, limit).map((product) => {
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
  const queue = buildStudyQueue({
    ...state,
    newCardsPerDay: state.settings.newCardsPerDay,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  const due = dueCount();
  const streak = calculateStreak(state.reviews);
  const insights = learningInsights(state);
  const weakest = insights.weakProducts[0];
  const weakQueue = buildWeakStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  app.innerHTML = `
    <section class="page">
      <article class="hero-card">
        <div class="hero-top">
          <div>
            <p class="eyebrow" style="color:#d7f246">Dnešní dávka · 5–10 minut</p>
            <h1>${queue.length ? 'Pár karet a máte hotovo.' : 'Pro dnešek je hotovo.'}</h1>
            <p>${queue.length ? `${due} k opakování · ${Math.max(0, queue.length - due)} nových` : 'Další opakování na vás čeká později.'}</p>
          </div>
          <div class="due-bubble"><strong>${queue.length}</strong><span>karet dnes</span></div>
        </div>
        <div class="hero-actions">
          <button id="start-study" class="button button-primary" type="button" ${queue.length ? '' : 'disabled'}>${queue.length ? 'Denní mix' : 'Denní mix splněn'}</button>
          <button id="open-topic-study" class="button button-ghost" type="button">Podle tématu</button>
          <button id="start-weak-home" class="button button-ghost" type="button">Co mi nejde${weakQueue.length ? ` · ${weakQueue.length}` : ''}</button>
        </div>
      </article>
      <div class="stats-grid" aria-label="Přehled pokroku">
        <div class="stat-card"><strong>${streak}</strong><span>${streak === 1 ? 'den série' : streak >= 2 && streak <= 4 ? 'dny série' : 'dní série'}</span></div>
        <div class="stat-card"><strong>${totalMastery()} %</strong><span>zvládnutí</span></div>
        <div class="stat-card"><strong>${masteredProducts()}/${state.products.length}</strong><span>produktů jistě</span></div>
      </div>
      <article class="recommendation-card">
        <div><p class="eyebrow">Doporučení</p><h2>${weakest ? `Zaměřte se na ${escapeHtml(weakest.name)}` : 'Pokračujte v pravidelném opakování'}</h2>
        <p>${weakest ? `${weakest.weakQuestionCount} ${weakest.weakQuestionCount === 1 ? 'otázka potřebuje' : 'otázek potřebuje'} upevnit. Slabší otázky už mají v denní dávce přednost.` : state.reviews.length ? 'Aktuálně nemáte výrazné slabé místo. Další otázky se objeví v optimálním termínu.' : 'Po prvních odpovědích zde uvidíte konkrétní doporučení.'}</p></div>
        <button class="button button-secondary" type="button" data-view-link="stats">Otevřít statistiky</button>
      </article>
      <div class="section-heading"><h2>Produkty v kurzu</h2><span>Klepnutím otevřít</span></div>
      <div class="mini-products">${productRows(3)}</div>
    </section>`;
  bindCommonActions();
  document.querySelector('#start-study')?.addEventListener('click', startStudy);
  document.querySelector('#open-topic-study')?.addEventListener('click', openTopicDialog);
  document.querySelector('#start-weak-home')?.addEventListener('click', () => startWeakStudy(weakQueue));
}

function productCard(product) {
  const mastery = productMastery(product.id, state.questions, state.progress);
  return `<button class="product-card" type="button" data-product-id="${product.id}">
    <img src="${product.image}" alt="${escapeHtml(product.name)}" width="240" height="240" loading="lazy">
    <span class="product-card-body"><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.category)}</p>
    <span class="progress-track"><span style="width:${mastery}%"></span></span>
    <span class="progress-label"><span>Zvládnutí</span><strong>${mastery} %</strong></span></span>
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
  app.innerHTML = `
    <section class="page">
      <header class="page-header catalog-header"><div><p class="eyebrow">Katalog · ${state.products.length} produktů</p><h1>Produkty</h1><p>Vyhledejte produkt nebo si katalog seřaďte tak, jak se vám učí nejlépe.</p></div></header>
      <div class="catalog-tools">
        <label class="catalog-search"><span class="visually-hidden">Hledat produkt</span><input id="product-search" type="search" placeholder="Hledat produkt nebo kategorii…" autocomplete="off"></label>
        <div class="view-switch" aria-label="Zobrazení produktů">
          <button type="button" data-catalog-view="grid" aria-label="Mřížka" aria-pressed="${view === 'grid'}" title="Mřížka"><span aria-hidden="true">▦</span><span>Mřížka</span></button>
          <button type="button" data-catalog-view="list" aria-label="Seznam" aria-pressed="${view === 'list'}" title="Seznam"><span aria-hidden="true">☷</span><span>Seznam</span></button>
          <button type="button" data-catalog-view="category" aria-label="Kategorie" aria-pressed="${view === 'category'}" title="Podle kategorií"><span aria-hidden="true">≡</span><span>Kategorie</span></button>
        </div>
      </div>
      <div id="product-collection">${productCollection(state.products, view)}</div>
    </section>`;
  bindCommonActions();
  document.querySelector('#product-search').addEventListener('input', (event) => {
    const query = normalizeText(event.target.value);
    const filtered = query ? state.products.filter((product) => normalizeText(`${product.name} ${product.category} ${product.brand || ''}`).includes(query)) : state.products;
    document.querySelector('#product-collection').innerHTML = productCollection(filtered, view);
    bindCommonActions();
  });
  document.querySelectorAll('[data-catalog-view]').forEach((button) => button.addEventListener('click', async () => {
    state.settings = await storage.saveSettings({ productCatalogView: button.dataset.catalogView });
    renderProducts();
  }));
}

function renderStats() {
  const insights = learningInsights(state);
  const weakQueue = buildWeakStudyQueue({
    ...state,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
    enabledProductIds: selectedProductIds(),
  });
  const recentAccuracy = insights.recentReviews ? `${insights.recentSecurePercent} %` : '—';
  app.innerHTML = `
    <section class="page">
      <header class="page-header"><p class="eyebrow">Výsledky a další krok</p><h1>Statistiky</h1><p>Přehled vychází z vašich odpovědí uložených na tomto zařízení.</p></header>
      <div class="stats-grid stats-grid-detailed" aria-label="Statistiky učení">
        <div class="stat-card"><strong>${insights.totalReviews}</strong><span>${insights.totalReviews === 1 ? 'odpověď celkem' : 'odpovědí celkem'}</span></div>
        <div class="stat-card"><strong>${recentAccuracy}</strong><span>jistých za 7 dní</span></div>
        <div class="stat-card"><strong>${insights.learnedQuestions}/${insights.totalQuestions}</strong><span>vyzkoušených otázek</span></div>
        <div class="stat-card"><strong>${calculateStreak(state.reviews)}</strong><span>${calculateStreak(state.reviews) === 1 ? 'den v sérii' : 'dní v sérii'}</span></div>
      </div>
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
      <details class="research-note"><summary>Jak funguje častější opakování?</summary><p>Plánovač FSRS zkrátí interval po chybě nebo nejisté odpovědi. Otázky se neopakují bezhlavě za sebou: aktivní vybavování je rozložené v čase a přizpůsobené vašim výsledkům.</p></details>
    </section>`;
  bindCommonActions();
  document.querySelector('#start-weak-study')?.addEventListener('click', () => startWeakStudy(weakQueue));
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
      <header class="page-header"><p class="eyebrow">Přizpůsobení a záloha</p><h1>Nastavení</h1></header>
      <div class="settings-list">
        <article class="settings-card">
          <div class="field-row"><div><h2>Nové otázky denně</h2><p>Opakování mají vždy přednost.</p></div>
          <select id="new-limit" aria-label="Počet nových otázek denně">${[3, 5, 10, 15].map((n) => `<option value="${n}" ${state.settings.newCardsPerDay === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
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
        <article class="settings-card"><h2>Záloha pokroku</h2><p>Soubor obsahuje váš profil, nastavení a nezměnitelnou historii opakování. Hodí se při výměně telefonu.</p>
          <div class="action-row"><button id="export" class="button button-secondary" type="button">Exportovat</button><button id="import" class="button button-secondary" type="button">Importovat</button></div>
        </article>
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
  document.querySelector('#import').addEventListener('click', () => document.querySelector('#import-file').click());
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
  document.querySelector('#product-detail').innerHTML = `
    <img class="product-detail-image" src="${product.image}" alt="${escapeHtml(product.name)}">
    <div class="product-detail-body">
      <button class="dialog-close" type="button" aria-label="Zavřít">×</button>
      <p class="eyebrow">${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2>
      ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ''}
      ${productFacts.length ? `<dl class="product-facts">${productFacts.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
      <h3>Složení</h3><p>${product.ingredients.map(escapeHtml).join(', ')}</p>
      <h3>Alergeny</h3><div class="allergen-list">${allergens}</div>
      ${product.specifics?.length ? `<h3>Čím je produkt specifický</h3><ul>${product.specifics.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
      <h3>Použití a uchování</h3><ol>${product.preparation.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
      ${product.brandInfo ? `<h3>O značce</h3><p>${escapeHtml(product.brandInfo)}</p>` : ''}
      <h3>Doporučení k prodeji</h3><p class="sales-tip">${escapeHtml(product.salesTip)}</p>
      ${sources ? `<h3>Zdroje informací</h3><div class="source-links">${sources}</div>` : ''}
      <div class="product-lifecycle-actions">
        <button id="archive-product" class="button button-danger button-full" type="button">Vyřadit produkt</button>
        <p>Produkt zmizí z katalogu a testů. Dosavadní pokrok se nesmaže a produkt půjde obnovit v Nastavení.</p>
      </div>
    </div>`;
  productDialog.querySelector('.dialog-close').addEventListener('click', () => productDialog.close());
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
    limit: 10,
  });
  if (!queue.length) {
    showToast('Pro toto téma nejsou dostupné otázky.');
    return;
  }
  topicDialog.close();
  startStudySession(queue, 'topic');
}

function startStudySession(queue, mode) {
  state.session = { queue: [...queue], index: 0, answers: [], revealed: false, retryIds: new Set(), mode };
  state.currentView = 'study';
  setActiveNav('');
  renderQuestion();
}

function currentQuestion() { return state.session?.queue[state.session.index]; }

function renderQuestion() {
  const question = currentQuestion();
  if (!question) return renderSummary();
  state.session.revealed = false;
  const product = state.products.find((item) => item.id === question.productId);
  const image = question.type === 'photo' ? `<img class="question-image" src="${question.image}" alt="Produkt k poznání">` : '';
  let control = '';
  if (question.type === 'mcq' || question.type === 'photo') {
    control = `<div class="options">${question.options.map((option) => `<button class="option" type="button" data-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>`;
  } else if (question.type === 'text') {
    control = `<form id="text-form"><input class="text-answer" name="answer" autocomplete="off" required placeholder="Napište odpověď…" aria-label="Vaše odpověď"><button class="button button-primary button-full">Zkontrolovat</button></form>`;
  } else {
    control = `<button id="reveal" class="button button-primary button-full" type="button">Ukázat odpověď</button>`;
  }
  app.innerHTML = `<section class="page study-page">
    <div class="study-toolbar"><button id="close-study" class="icon-button" type="button" aria-label="Ukončit trénink">×</button>
      <div><div class="progress-track"><span style="width:${((state.session.index) / state.session.queue.length) * 100}%"></span></div></div>
      <span class="study-counter">${state.session.index + 1}/${state.session.queue.length}</span></div>
    <article class="study-card"><div class="question-meta"><span class="type-pill">${TYPE_LABELS[question.type]}</span><span>${escapeHtml(product.name)}</span></div>
      ${image}<h1>${escapeHtml(question.prompt)}</h1><div id="answer-area">${control}</div><div id="feedback"></div>
    </article></section>`;
  document.querySelector('#close-study').addEventListener('click', () => navigate('home'));
  document.querySelectorAll('[data-option]').forEach((button) => button.addEventListener('click', () => answerChoice(button.dataset.option)));
  document.querySelector('#text-form')?.addEventListener('submit', (event) => { event.preventDefault(); answerText(new FormData(event.currentTarget).get('answer')); });
  document.querySelector('#reveal')?.addEventListener('click', revealFlashcard);
  window.scrollTo({ top: 0, behavior: 'instant' });
  app.focus();
}

function showFeedback({ correct, answer, explanation }) {
  const panel = document.querySelector('#feedback');
  panel.innerHTML = `<div class="answer-panel ${correct ? '' : 'is-wrong'}"><strong>${correct ? 'Správně' : 'Správná odpověď'}</strong><p>${escapeHtml(answer)}</p><p class="answer-explanation">${escapeHtml(explanation)}</p></div><button id="next" class="button button-primary button-full" style="margin-top:.8rem" type="button">Pokračovat</button>`;
  document.querySelector('#next').addEventListener('click', nextQuestion);
}

async function answerChoice(selected) {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const correct = selected === question.answer;
  document.querySelectorAll('.option').forEach((button) => {
    button.disabled = true;
    if (button.dataset.option === question.answer) button.classList.add('is-correct');
    if (button.dataset.option === selected && !correct) button.classList.add('is-wrong');
  });
  await recordReview(question, correct ? RATINGS.GOOD : RATINGS.AGAIN, correct);
  showFeedback({ correct, answer: question.answer, explanation: question.explanation });
}

async function answerText(input) {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const result = evaluateText(input, question.answer);
  document.querySelector('#text-form').querySelectorAll('input,button').forEach((element) => { element.disabled = true; });
  await recordReview(question, result.correct ? RATINGS.GOOD : RATINGS.AGAIN, result.correct);
  showFeedback({ correct: result.correct, answer: question.answerDisplay || (Array.isArray(question.answer) ? question.answer.join(', ') : question.answer), explanation: question.explanation });
}

function revealFlashcard() {
  if (state.session.revealed) return;
  state.session.revealed = true;
  const question = currentQuestion();
  const intervals = getIntervals(state.progress[question.id]);
  document.querySelector('#answer-area').innerHTML = `<div class="answer-panel"><strong>Odpověď</strong><p>${escapeHtml(question.answer)}</p><p class="answer-explanation">${escapeHtml(question.explanation)}</p></div>
    <p style="font-weight:750;margin:1rem 0 .4rem">Jak dobře jste si vzpomněli?</p>
    <div class="rating-grid">${[RATINGS.AGAIN, RATINGS.HARD, RATINGS.GOOD, RATINGS.EASY].map((rating) => `<button class="rating ${rating === RATINGS.AGAIN ? 'rating-again' : rating === RATINGS.EASY ? 'rating-easy' : ''}" type="button" data-rating="${rating}">${ratingLabel(rating)}<small>${formatInterval(intervals[rating])}</small></button>`).join('')}</div>`;
  document.querySelectorAll('[data-rating]').forEach((button) => button.addEventListener('click', async () => {
    document.querySelectorAll('[data-rating]').forEach((item) => { item.disabled = true; });
    const rating = Number(button.dataset.rating);
    await recordReview(question, rating, rating >= RATINGS.GOOD);
    nextQuestion();
  }));
}

function formatInterval(date) {
  const minutes = Math.max(1, Math.round((new Date(date) - new Date()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

async function recordReview(question, rating, correct) {
  const wasNew = !state.reviews.some((review) => review.questionId === question.id);
  const review = {
    id: crypto.randomUUID(), userId: state.profile.userId, questionId: question.id,
    rating, reviewedAt: new Date().toISOString(), wasNew,
  };
  await storage.appendReview(review);
  state.reviews.push(review);
  const history = state.reviews.filter((item) => item.questionId === question.id);
  state.progress[question.id] = rebuildProgress(history);
  await storage.saveQuestionProgress(question.id, state.progress[question.id]);
  state.session.answers.push({ questionId: question.id, productId: question.productId, correct, rating });
  const remainingQuestions = state.session.queue.length - state.session.index - 1;
  if (rating <= RATINGS.HARD && remainingQuestions >= 3 && !state.session.retryIds.has(question.id)) {
    const insertAt = Math.min(state.session.queue.length, state.session.index + 4);
    state.session.queue.splice(insertAt, 0, question);
    state.session.retryIds.add(question.id);
  }
}

function nextQuestion() {
  state.session.index += 1;
  renderQuestion();
}

function renderSummary() {
  const answers = state.session.answers;
  const correct = answers.filter((item) => item.correct).length;
  const accuracy = answers.length ? Math.round(correct / answers.length * 100) : 0;
  const misses = Object.entries(answers.filter((item) => !item.correct).reduce((acc, item) => ({ ...acc, [item.productId]: (acc[item.productId] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const problem = misses.length ? state.products.find((product) => product.id === misses[0][0])?.name : 'Žádný — skvělá práce';
  app.innerHTML = `<section class="page study-page"><article class="summary-card"><div class="summary-icon">✓</div><p class="eyebrow">Dávka dokončena</p><h1>Dobrá práce, ${escapeHtml(state.profile.nickname)}.</h1><p>Každé vybavení odpovědi posílilo paměťovou stopu.</p>
    <div class="summary-stats"><div><strong>${accuracy} %</strong><span>úspěšnost</span></div><div><strong>${correct}/${answers.length}</strong><span>správně</span></div><div><strong>${tomorrowCount()}</strong><span>do zítřka</span></div></div>
    <div class="answer-panel" style="text-align:left"><strong>Produkt k procvičení</strong><p>${escapeHtml(problem)}</p></div>
    ${misses.length ? '<button id="open-stats" class="button button-secondary button-full" style="margin-top:.7rem" type="button">Zobrazit slabá místa</button>' : ''}
    <button id="finish" class="button button-primary button-full" style="margin-top:1rem" type="button">Zpět na dnešek</button></article></section>`;
  document.querySelector('#finish').addEventListener('click', () => navigate('home'));
  document.querySelector('#open-stats')?.addEventListener('click', () => navigate('stats'));
  window.scrollTo({ top: 0, behavior: 'instant' });
  updateBadge();
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
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `bistro-pokrok-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast('Záloha je stažená.');
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
  const [{ products, questions }, profile, reviews, settings] = await Promise.all([
    contentProvider.getAll(), storage.getProfile(), storage.getReviews(), storage.getSettings(),
  ]);
  Object.assign(state, { catalogProducts: products, catalogQuestions: questions, profile, reviews, settings });
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
    const registration = await navigator.serviceWorker.register('./sw.js');
    const checkForUpdate = () => registration.update().catch((error) => console.warn('Kontrola aktualizace se nezdařila.', error));

    checkForUpdate();
    window.addEventListener('focus', checkForUpdate);
    window.addEventListener('online', checkForUpdate);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
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
document.querySelector('#import-file').addEventListener('change', (event) => { if (event.target.files[0]) importBackup(event.target.files[0]); event.target.value = ''; });

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
