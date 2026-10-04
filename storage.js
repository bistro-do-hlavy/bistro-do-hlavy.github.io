import { CONFIG } from './config.js?v=1.0.30';

const KEY = 'bistro-do-hlavy:v1';

const emptyState = () => ({
  schemaVersion: CONFIG.SCHEMA_VERSION,
  profile: null,
  progress: {},
  reviews: [],
  productNotes: {},
  settings: {
    newCardsPerDay: CONFIG.DEFAULT_NEW_CARDS_PER_DAY,
    theme: 'system',
    enabledQuestionTypes: ['mcq', 'flashcard', 'text', 'photo'],
    enabledProductIds: null,
    archivedProductIds: [],
    productCatalogView: 'grid',
  },
});

const clone = (value) => structuredClone(value);

export class LocalAdapter {
  #read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY));
      return parsed?.schemaVersion === CONFIG.SCHEMA_VERSION
        ? { ...emptyState(), ...parsed, settings: { ...emptyState().settings, ...parsed.settings } }
        : emptyState();
    } catch {
      return emptyState();
    }
  }

  #write(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  async getProfile() { return clone(this.#read().profile); }
  async saveProfile(profile) {
    const state = this.#read();
    state.profile = clone(profile);
    this.#write(state);
    return clone(profile);
  }

  async getProgress() { return clone(this.#read().progress); }
  async saveQuestionProgress(questionId, progress) {
    const state = this.#read();
    state.progress[questionId] = clone(progress);
    this.#write(state);
    return clone(progress);
  }

  async getReviews() { return clone(this.#read().reviews); }
  async appendReview(review) {
    const state = this.#read();
    if (!state.reviews.some((item) => item.id === review.id)) state.reviews.push(clone(review));
    this.#write(state);
    return clone(review);
  }

  async getProductNotes() { return clone(this.#read().productNotes); }
  async saveProductNote(productId, note) {
    const state = this.#read();
    const value = String(note || '').trim();
    if (value) state.productNotes[productId] = value;
    else delete state.productNotes[productId];
    this.#write(state);
    return value;
  }

  async getSettings() { return clone(this.#read().settings); }
  async saveSettings(settings) {
    const state = this.#read();
    state.settings = { ...state.settings, ...clone(settings) };
    this.#write(state);
    return clone(state.settings);
  }

  async exportData() {
    const state = this.#read();
    return {
      format: 'bistro-learning-sync',
      schemaVersion: CONFIG.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      progress: state.progress,
      reviews: state.reviews,
      productNotes: state.productNotes,
      settings: state.settings,
    };
  }

  async importData(payload) {
    if (payload?.format !== 'bistro-learning-sync' || payload.schemaVersion !== CONFIG.SCHEMA_VERSION) {
      throw new Error('Soubor nemá podporovaný formát zálohy.');
    }
    if (!payload.profile?.userId || !Array.isArray(payload.reviews)) {
      throw new Error('Záloha je neúplná.');
    }
    const uniqueReviews = [...new Map(payload.reviews.map((review) => [review.id, review])).values()];
    const state = {
      ...emptyState(),
      profile: clone(payload.profile),
      progress: clone(payload.progress || {}),
      reviews: clone(uniqueReviews),
      productNotes: clone(payload.productNotes || {}),
      settings: { ...emptyState().settings, ...(payload.settings || {}) },
    };
    this.#write(state);
    return clone(state);
  }
}

export const storage = new LocalAdapter();
