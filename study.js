import { CONFIG } from './config.js?v=1.0.10';
import { RATINGS, rebuildProgress } from './fsrs-service.js?v=1.0.10';

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function evaluateText(input, expected) {
  const answers = Array.isArray(expected) ? expected : [expected];
  const submitted = String(input).split(/[,;\n]+/).map(normalizeText).filter(Boolean);
  const results = answers.map((answer) => ({
    answer,
    matched: submitted.includes(normalizeText(answer)),
  }));
  return { correct: results.every((item) => item.matched), results };
}

const localDay = (iso) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(new Date(iso));

export function calculateStreak(reviews) {
  const days = new Set(reviews.map((review) => localDay(review.reviewedAt)));
  let streak = 0;
  const cursor = new Date();
  if (!days.has(localDay(cursor.toISOString()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(localDay(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function buildProgressFromReviews(questions, reviews) {
  const byQuestion = reviews.reduce((groups, review) => {
    (groups[review.questionId] ||= []).push(review);
    return groups;
  }, {});
  return Object.fromEntries(questions.map((question) => {
    const history = byQuestion[question.id] || [];
    return [question.id, history.length ? rebuildProgress(history) : null];
  }));
}

export function productMastery(productId, questions, progress) {
  const related = questions.filter((question) => question.productId === productId);
  if (!related.length) return 0;
  const stable = related.filter((question) => (progress[question.id]?.stability || 0) >= CONFIG.FSRS_STABILITY_MASTERY_DAYS);
  return Math.round((stable.length / related.length) * 100);
}

export function buildStudyQueue({
  products,
  questions,
  progress,
  reviews,
  newCardsPerDay,
  enabledQuestionTypes = ['mcq', 'flashcard', 'text', 'photo'],
  enabledProductIds = null,
  now = new Date(),
}) {
  const enabledTypes = new Set(enabledQuestionTypes);
  const allowedProductIds = new Set(Array.isArray(enabledProductIds) ? enabledProductIds : products.map((product) => product.id));
  const selectedProducts = products.filter((product) => allowedProductIds.has(product.id));
  const selectedQuestions = questions.filter((question) => enabledTypes.has(question.type) && allowedProductIds.has(question.productId));
  const selectedQuestionIds = new Set(selectedQuestions.map((question) => question.id));
  const reviewedIds = new Set(reviews.map((review) => review.questionId));
  const reviewedSelectedIds = new Set(reviews.filter((review) => selectedQuestionIds.has(review.questionId)).map((review) => review.questionId));
  const unlockedCount = Math.min(selectedProducts.length, Math.max(1, Math.floor(reviewedSelectedIds.size / 6) + 1));
  const unlocked = new Set(selectedProducts.slice(0, unlockedCount).map((product) => product.id));
  const due = selectedQuestions.filter((question) => progress[question.id] && new Date(progress[question.id].due) <= now);
  const today = localDay(now.toISOString());
  const newSeenToday = new Set(reviews.filter((review) => selectedQuestionIds.has(review.questionId) && localDay(review.reviewedAt) === today && review.wasNew).map((review) => review.questionId)).size;
  const newLimit = Math.max(0, newCardsPerDay - newSeenToday);
  const fresh = selectedQuestions.filter((question) => !reviewedIds.has(question.id) && unlocked.has(question.productId)).slice(0, newLimit);
  const combined = [...due, ...fresh];
  const typeOrder = ['photo', 'text', 'mcq', 'flashcard'];
  return combined.sort((a, b) => {
    const aDue = progress[a.id] ? 0 : 1;
    const bDue = progress[b.id] ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    const productDiff = products.findIndex((p) => p.id === a.productId) - products.findIndex((p) => p.id === b.productId);
    return productDiff || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
  });
}

export function ratingLabel(rating) {
  return ({ [RATINGS.AGAIN]: 'Znovu', [RATINGS.HARD]: 'Těžké', [RATINGS.GOOD]: 'Dobré', [RATINGS.EASY]: 'Snadné' })[rating];
}
