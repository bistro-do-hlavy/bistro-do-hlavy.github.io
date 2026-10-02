const PRODUCT_URL = './data/products.json';
const QUESTION_URL = './data/questions.json';
const PENDING_PRODUCT_URL = './data/pending-products.json';

export class JsonContentProvider {
  async #load(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Obsah se nepodařilo načíst (${response.status}).`);
    return response.json();
  }

  async getProducts() {
    return this.#load(PRODUCT_URL);
  }

  async getQuestions() {
    return this.#load(QUESTION_URL);
  }

  async getPendingProducts() {
    return this.#load(PENDING_PRODUCT_URL);
  }

  async getAll() {
    const [products, questions, pendingProducts] = await Promise.all([
      this.getProducts(), this.getQuestions(), this.getPendingProducts(),
    ]);
    return { products, questions, pendingProducts };
  }
}

export const contentProvider = new JsonContentProvider();
