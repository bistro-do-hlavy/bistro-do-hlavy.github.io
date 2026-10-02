import { CONFIG } from './config.js?v=1.0.25';
import { RATINGS, rebuildProgress } from './fsrs-service.js?v=1.0.25';

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

function reviewsByQuestion(reviews) {
  return reviews.reduce((groups, review) => {
    (groups[review.questionId] ||= []).push(review);
    return groups;
  }, {});
}

export function questionWeakness(questionId, reviews, progress) {
  const history = reviews
    .filter((review) => review.questionId === questionId)
    .sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))
    .slice(-8);
  if (!history.length) return -1;

  const uncertain = history.filter((review) => review.rating < RATINGS.GOOD).length / history.length;
  const lastRating = history.at(-1).rating;
  const lastPenalty = lastRating === RATINGS.AGAIN ? 30 : lastRating === RATINGS.HARD ? 16 : 0;
  const stability = progress?.stability || 0;
  const stabilityPenalty = Math.max(0, 1 - stability / CONFIG.FSRS_STABILITY_MASTERY_DAYS) * 20;
  return Math.round(Math.min(100, uncertain * 60 + lastPenalty + stabilityPenalty));
}

export function buildWeakStudyQueue({
  products,
  questions,
  progress,
  reviews,
  enabledQuestionTypes = ['mcq', 'flashcard', 'text', 'photo'],
  enabledProductIds = null,
  limit = 10,
}) {
  const enabledTypes = new Set(enabledQuestionTypes);
  const allowedProductIds = new Set(Array.isArray(enabledProductIds) ? enabledProductIds : products.map((product) => product.id));
  return questions
    .filter((question) => enabledTypes.has(question.type) && allowedProductIds.has(question.productId))
    .map((question) => ({ question, weakness: questionWeakness(question.id, reviews, progress[question.id]) }))
    .filter((item) => item.weakness >= 25)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, limit)
    .map((item) => item.question);
}

export function buildTopicStudyQueue({
  products,
  questions,
  progress,
  reviews,
  enabledQuestionTypes = ['mcq', 'flashcard', 'text', 'photo'],
  enabledProductIds = null,
  limit = 10,
  now = new Date(),
}) {
  const enabledTypes = new Set(enabledQuestionTypes);
  const allowedProductIds = new Set(Array.isArray(enabledProductIds) ? enabledProductIds : products.map((product) => product.id));
  const productOrder = new Map(products.map((product, index) => [product.id, index]));
  const reviewedQuestionIds = new Set(reviews.map((review) => review.questionId));
  const typeOrder = ['photo', 'text', 'mcq', 'flashcard'];

  return questions
    .filter((question) => enabledTypes.has(question.type) && allowedProductIds.has(question.productId))
    .map((question) => {
      const dueAt = progress[question.id]?.due ? new Date(progress[question.id].due) : null;
      const weakness = questionWeakness(question.id, reviews, progress[question.id]);
      const priority = dueAt && dueAt <= now ? 0 : weakness >= 25 ? 1 : !reviewedQuestionIds.has(question.id) ? 2 : 3;
      return { question, priority, weakness, dueAt };
    })
    .sort((a, b) => a.priority - b.priority
      || b.weakness - a.weakness
      || (a.dueAt?.getTime() || Infinity) - (b.dueAt?.getTime() || Infinity)
      || typeOrder.indexOf(a.question.type) - typeOrder.indexOf(b.question.type)
      || productOrder.get(a.question.productId) - productOrder.get(b.question.productId))
    .slice(0, limit)
    .map((item) => item.question);
}

export function learningInsights({ products, questions, progress, reviews, now = new Date() }) {
  const activeQuestionIds = new Set(questions.map((question) => question.id));
  const activeReviews = reviews.filter((review) => activeQuestionIds.has(review.questionId));
  const histories = reviewsByQuestion(activeReviews);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recent = activeReviews.filter((review) => new Date(review.reviewedAt) >= sevenDaysAgo);
  const secure = (items) => items.filter((review) => review.rating >= RATINGS.GOOD).length;
  const percentage = (items) => items.length ? Math.round(secure(items) / items.length * 100) : 0;
  const learnedQuestionIds = new Set(activeReviews.map((review) => review.questionId));

  const weakProducts = products.map((product) => {
    const productQuestions = questions.filter((question) => question.productId === product.id);
    const productReviews = productQuestions.flatMap((question) => histories[question.id] || []);
    const weakQuestions = productQuestions
      .map((question) => questionWeakness(question.id, activeReviews, progress[question.id]))
      .filter((score) => score >= 25);
    return {
      productId: product.id,
      name: product.name,
      category: product.category,
      attempts: productReviews.length,
      securePercent: percentage(productReviews),
      weakQuestionCount: weakQuestions.length,
      score: weakQuestions.length ? Math.round(weakQuestions.reduce((sum, value) => sum + value, 0) / weakQuestions.length) : 0,
    };
  }).filter((product) => product.attempts > 0 && product.weakQuestionCount > 0)
    .sort((a, b) => b.score - a.score || a.securePercent - b.securePercent);

  return {
    totalReviews: activeReviews.length,
    recentReviews: recent.length,
    overallSecurePercent: percentage(activeReviews),
    recentSecurePercent: percentage(recent),
    learnedQuestions: learnedQuestionIds.size,
    totalQuestions: questions.length,
    weakProducts,
  };
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
    if (!aDue && !bDue) {
      const weaknessDiff = questionWeakness(b.id, reviews, progress[b.id]) - questionWeakness(a.id, reviews, progress[a.id]);
      if (weaknessDiff) return weaknessDiff;
    }
    const productDiff = products.findIndex((p) => p.id === a.productId) - products.findIndex((p) => p.id === b.productId);
    return productDiff || typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
  });
}

export function ratingLabel(rating) {
  return ({ [RATINGS.AGAIN]: 'Znovu', [RATINGS.HARD]: 'Těžké', [RATINGS.GOOD]: 'Dobré', [RATINGS.EASY]: 'Snadné' })[rating];
}
