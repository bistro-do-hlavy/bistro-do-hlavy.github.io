import { CONFIG } from '../config.js?v=1.0.7';
import { contentProvider } from '../content.js?v=1.0.7';
import { storage } from '../storage.js?v=1.0.7';
import { RATINGS, getIntervals, rebuildProgress } from '../fsrs-service.js?v=1.0.7';
import {
  buildProgressFromReviews,
  buildStudyQueue,
  calculateStreak,
  evaluateText,
  productMastery,
  ratingLabel,
} from '../study.js?v=1.0.7';

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
  products: [], questions: [], reviews: [], progress: {}, profile: null, settings: null,
  currentView: 'home', session: null,
};

const app = document.querySelector('#app');
const profileDialog = document.querySelector('#profile-dialog');
const productDialog = document.querySelector('#product-dialog');
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

function dueCount(now = new Date()) {
  const enabledTypes = new Set(state.settings?.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  return state.questions.filter((question) => enabledTypes.has(question.type) && state.progress[question.id] && new Date(state.progress[question.id].due) <= now).length;
}

function tomorrowCount() {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  end.setHours(23, 59, 59, 999);
  const enabledTypes = new Set(state.settings?.enabledQuestionTypes || Object.keys(TYPE_LABELS));
  return state.questions.filter((question) => enabledTypes.has(question.type) && state.progress[question.id] && new Date(state.progress[question.id].due) <= end).length;
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
  });
  const due = dueCount();
  const streak = calculateStreak(state.reviews);
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
          <button id="start-study" class="button button-primary" type="button" ${queue.length ? '' : 'disabled'}>${queue.length ? 'Spustit trénink' : 'Dávka splněna'}</button>
          <button class="button button-ghost" type="button" data-view-link="products">Projít produkty</button>
        </div>
      </article>
      <div class="stats-grid" aria-label="Přehled pokroku">
        <div class="stat-card"><strong>${streak}</strong><span>${streak === 1 ? 'den série' : streak >= 2 && streak <= 4 ? 'dny série' : 'dní série'}</span></div>
        <div class="stat-card"><strong>${totalMastery()} %</strong><span>zvládnutí</span></div>
        <div class="stat-card"><strong>${masteredProducts()}/${state.products.length}</strong><span>produktů jistě</span></div>
      </div>
      <div class="section-heading"><h2>Produkty v kurzu</h2><span>Klepnutím otevřít</span></div>
      <div class="mini-products">${productRows(3)}</div>
    </section>`;
  bindCommonActions();
  document.querySelector('#start-study')?.addEventListener('click', startStudy);
}

function renderProducts() {
  app.innerHTML = `
    <section class="page">
      <header class="page-header"><p class="eyebrow">Katalog</p><h1>Produkty</h1><p>Všechny informace na jednom místě. Zvládnutí roste, když jsou otázky stabilní déle než 21 dní.</p></header>
      <div class="product-grid">
        ${state.products.map((product) => {
          const mastery = productMastery(product.id, state.questions, state.progress);
          return `<button class="product-card" type="button" data-product-id="${product.id}">
            <img src="${product.image}" alt="${escapeHtml(product.name)}" width="800" height="800">
            <span class="product-card-body"><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.category)}</p>
            <span class="progress-track"><span style="width:${mastery}%"></span></span>
            <span class="progress-label"><span>Zvládnutí</span><strong>${mastery} %</strong></span></span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  bindCommonActions();
}

function renderSettings() {
  const enabledQuestionTypes = state.settings.enabledQuestionTypes || Object.keys(TYPE_LABELS);
  const describeQuestionTypes = (types) => types.length === QUESTION_TYPE_SETTINGS.length
    ? 'Mix všech'
    : `${types.length} ${types.length === 1 ? 'typ' : 'typy'} · ${types.map((type) => TYPE_LABELS[type]).join(', ')}`;
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
  document.querySelector('#product-detail').innerHTML = `
    <img class="product-detail-image" src="${product.image}" alt="${escapeHtml(product.name)}">
    <div class="product-detail-body">
      <button class="dialog-close" type="button" aria-label="Zavřít">×</button>
      <p class="eyebrow">${escapeHtml(product.category)}</p><h2>${escapeHtml(product.name)}</h2>
      <h3>Složení</h3><p>${product.ingredients.map(escapeHtml).join(', ')}</p>
      <h3>Alergeny</h3><div class="allergen-list">${product.allergens.map((id) => `<span class="allergen-chip">${id} · ${ALLERGENS[id]}</span>`).join('')}</div>
      <h3>Příprava</h3><ol>${product.preparation.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
      <h3>Doporučení k prodeji</h3><p class="sales-tip">${escapeHtml(product.salesTip)}</p>
    </div>`;
  productDialog.querySelector('.dialog-close').addEventListener('click', () => productDialog.close());
  productDialog.showModal();
}

function startStudy() {
  const queue = buildStudyQueue({
    ...state,
    newCardsPerDay: state.settings.newCardsPerDay,
    enabledQuestionTypes: state.settings.enabledQuestionTypes,
  });
  if (!queue.length) return;
  state.session = { queue, index: 0, answers: [], revealed: false };
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
    <button id="finish" class="button button-primary button-full" style="margin-top:1rem" type="button">Zpět na dnešek</button></article></section>`;
  document.querySelector('#finish').addEventListener('click', () => navigate('home'));
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
  Object.assign(state, { products, questions, profile, reviews, settings });
  state.progress = buildProgressFromReviews(questions, reviews);
  applyTheme(settings.theme);
  updateProfileChip();
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
document.querySelector('#import-file').addEventListener('change', (event) => { if (event.target.files[0]) importBackup(event.target.files[0]); event.target.value = ''; });

try {
  await loadState();
  renderHome();
  if (!state.profile) openProfileDialog(true);
  updateBadge();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
} catch (error) {
  console.error(error);
  app.innerHTML = `<section class="empty-state"><div><h1>Aplikaci se nepodařilo načíst</h1><p>Zkontrolujte připojení při prvním spuštění a zkuste stránku obnovit.</p><button class="button button-primary" onclick="location.reload()">Načíst znovu</button></div></section>`;
}
