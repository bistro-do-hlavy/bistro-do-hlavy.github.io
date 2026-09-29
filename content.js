const PRODUCT_URL = './data/products.json';
const QUESTION_URL = './data/questions.json';

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

  async getAll() {
    const [products, questions] = await Promise.all([this.getProducts(), this.getQuestions()]);
    return { products, questions };
  }
}

export const contentProvider = new JsonContentProvider();
