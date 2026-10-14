import { CONFIG } from './config.js';
import { RATINGS, rebuildProgress } from './fsrs-service.js';

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('cs')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeAnswerText(value) {
  return normalizeText(value)
    .replace(/\b(\d)\s+(?=\d{3}\b)/g, '$1')
    .replace(/\b(zadny|zadna|zadne|zadnou|zadnych)\b/g, 'zadny')
    .replace(/\b(alergeny|alergenu|alergenem|alergenech)\b/g, 'alergen')
    .replace(/\b(minuta|minuty|minut|min)\b/g, 'min')
    .replace(/\b(hodina|hodiny|hodin|hod)\b/g, 'hod')
    .replace(/\b(dny|dni|dnu)\b/g, 'den')
    .replace(/\b(gramu|gramy|gram|g)\b/g, 'g')
    .replace(/\b(mililitru|mililitry|mililitr|ml)\b/g, 'ml')
    .replace(/\b(kilogramu|kilogramy|kilogram|kg)\b/g, 'kg')
    .replace(/\b(litru|litry|litr|l)\b/g, 'l')
    .replace(/\b(dekofeinovan\w*|bezkofeinov\w*)\b/g, 'bez kofeinu')
    .replace(/\s+/g, ' ')
    .trim();
}

const ANSWER_STOP_WORDS = new Set([
  'a', 'ale', 'ani', 'az', 'bez', 'by', 'byl', 'byla', 'bylo', 'byt', 'ci', 'do', 'i', 'jak', 'jako',
  'je', 'jejich', 'jeho', 'ji', 'jich', 'k', 'ke', 'na', 'nebo', 'od', 'po', 'pod', 'podle', 'pro',
  'pred', 'pri', 's', 'se', 'ta', 'tak', 'tato', 'tento', 'to', 'toto', 'u', 'v', 've', 'z', 'za', 'ze',
  'produkt', 'produktu', 'vyrobek', 'vyrobku', 'spravne', 'odpoved', 'vyrobce', 'znacka', 'uvadi',
]);

function answerTokens(value) {
  return normalizeAnswerText(value).split(' ').filter((token) => token.length > 1 && !ANSWER_STOP_WORDS.has(token));
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + Number(left[i - 1] !== right[j - 1]));
      previous = above;
    }
  }
  return row[right.length];
}

function answerConcept(token) {
  if (/^(telo|pln\w*)$/.test(token)) return 'telo';
  if (/^(crema|krema|kremou|pen\w*)$/.test(token)) return 'crema';
  if (/^(chut\w*|ton\w*|arom\w*|vun\w*)$/.test(token)) return 'chutovy-projev';
  if (/^(sklad\w*|uchov\w*)$/.test(token)) return 'skladovani';
  if (/^(doporuc\w*|hod\w*)$/.test(token)) return 'vhodnost';
  return null;
}

function tokensMatch(left, right) {
  if (left === right) return true;
  if (/^\d/.test(left) || /^\d/.test(right)) return false;
  const leftConcept = answerConcept(left);
  if (leftConcept && leftConcept === answerConcept(right)) return true;
  const shortest = Math.min(left.length, right.length);
  if (shortest >= 4 && left.slice(0, Math.min(5, shortest)) === right.slice(0, Math.min(5, shortest))) return true;
  return shortest >= 5 && Math.abs(left.length - right.length) <= 1 && editDistance(left, right) <= 1;
}

function meansNoAllergen(value) {
  const normalized = normalizeAnswerText(value);
  return normalized === 'zadny'
    || normalized === 'nic'
    || /^zadny (z )?(14 )?(povinne( (znacenych|uvadenych))? )?alergen( eu)?$/.test(normalized)
    || /^bez (zadny )?(povinne( (znacenych|uvadenych))? )?alergen( eu)?$/.test(normalized)
    || /^neobsahuje (zadny( z 14)?( povinne( (znacenych|uvadenych))?)? )?alergen( eu)?$/.test(normalized);
}

function allergenConcepts(value) {
  const normalized = normalizeText(value);
  const concepts = new Set();
  const add = (concept, pattern) => { if (pattern.test(normalized)) concepts.add(concept); };
  add('lepek', /\b(lepek|gluten|obilovin\w* s lepk\w*)\b/);
  add('korysi', /\b(korys\w*|krevet\w*|krab\w*|humr\w*)\b/);
  add('vejce', /\b(vejce|vajick\w*)\b/);
  add('ryby', /\b(ryb\w*)\b/);
  add('arasidy', /\b(arasid\w*|burak\w*)\b/);
  add('soja', /\b(soj\w*)\b/);
  add('mleko', /\b(mlek\w*|mlec\w*)\b/);
  add('skorapkove-plody', /\b(skorapkov\w* plod\w*|orech\w*|mandl\w*|kesu|pistaci\w*|pekan\w*)\b/);
  add('celer', /\bceler\w*\b/);
  add('horcice', /\bhorcic\w*\b/);
  add('sezam', /\bsezam\w*\b/);
  add('siricitany', /\b(siricitan\w*|sulfit\w*|oxid siricity)\b/);
  add('vlci-bob', /\b(vlci bob|lupin\w*)\b/);
  add('mekkysi', /\b(mekkys\w*|musl\w*|chobotnic\w*|sepi\w*)\b/);
  return concepts;
}

function isAllergenOnlyAnswer(value) {
  const allowed = /^(?:lepek|gluten|obilovin\w*|s\s+lepk\w*|korys\w*|krevet\w*|krab\w*|humr\w*|vejce|vajick\w*|ryb\w*|arasid\w*|burak\w*|soj\w*|mlek\w*|mlec\w*|skorapkov\w*|plod\w*|orech\w*|mandl\w*|kesu|pistaci\w*|pekan\w*|celer\w*|horcic\w*|sezam\w*|siricitan\w*|sulfit\w*|oxid|siricity|vlci|bob|lupin\w*|mekkys\w*|musl\w*|chobotnic\w*|sepi\w*|a|nebo|stopy|stopa)$/;
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => allowed.test(token));
}

function answerMatchScore(submitted, expected, prompt = '') {
  const normalizedSubmitted = normalizeAnswerText(submitted);
  const normalizedExpected = normalizeAnswerText(expected);
  if (normalizedSubmitted === normalizedExpected) return 1;
  if (normalizedExpected === 'ne' && /^(ne|nikoli)$/.test(normalizedSubmitted)) return 1;
  if (meansNoAllergen(expected) && (meansNoAllergen(submitted) || normalizedSubmitted === 'ne')) return 1;

  const expectedAllergens = allergenConcepts(expected);
  if (expectedAllergens.size && isAllergenOnlyAnswer(expected)) {
    const submittedAllergens = allergenConcepts(submitted);
    return [...expectedAllergens].filter((concept) => submittedAllergens.has(concept)).length / expectedAllergens.size;
  }

  const promptTokens = answerTokens(prompt);
  const allExpectedTokens = answerTokens(expected);
  const expectedTokens = allExpectedTokens.filter((token) => !promptTokens.some((promptToken) => tokensMatch(token, promptToken)));
  if (!expectedTokens.length) expectedTokens.push(...allExpectedTokens);
  const submittedTokens = answerTokens(submitted);
  if (!expectedTokens.length || !submittedTokens.length) return 0;
  const numericTokens = expectedTokens.filter((token) => /^\d/.test(token));
  if (numericTokens.some((token) => !submittedTokens.includes(token))) return 0;
  const matched = expectedTokens.filter((expectedToken) => submittedTokens.some((submittedToken) => tokensMatch(submittedToken, expectedToken))).length;
  return matched / expectedTokens.length;
}

function isSufficientMatch(score, expected, prompt = '') {
  const promptTokens = answerTokens(prompt);
  const distinctiveTokens = answerTokens(expected).filter((token) => !promptTokens.some((promptToken) => tokensMatch(token, promptToken)));
  const tokenCount = distinctiveTokens.length || answerTokens(expected).length;
  if (tokenCount <= 1) return score === 1;
  if (tokenCount === 2) return score >= .5;
  if (tokenCount <= 4) return score >= .6;
  return score >= .45;
}

export function evaluateText(input, expected, prompt = '') {
  const answers = Array.isArray(expected) ? expected : [expected];
  const results = answers.map((answer) => ({
    answer,
    score: answerMatchScore(input, answer, prompt),
    matched: false,
  }));
  results.forEach((result) => { result.matched = isSufficientMatch(result.score, result.answer, prompt); });
  const correct = results.every((item) => item.matched);
  const averageScore = results.reduce((total, item) => total + item.score, 0) / Math.max(1, results.length);
  return { correct, partial: !correct && averageScore >= .3, score: averageScore, results };
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
  const typeOrder = ['text', 'mcq', 'photo', 'flashcard'];

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
      || productOrder.get(a.question.productId) - productOrder.get(b.question.productId)
      || typeOrder.indexOf(a.question.type) - typeOrder.indexOf(b.question.type))
    .slice(0, limit)
    .map((item) => item.question);
}

export function learningInsights({ products, questions, progress, reviews, now = new Date() }) {
  const activeQuestionIds = new Set(questions.map((question) => question.id));
  const activeReviews = reviews.filter((review) => activeQuestionIds.has(review.questionId));
  const histories = reviewsByQuestion(activeReviews);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recent = activeReviews.filter((review) => new Date(review.reviewedAt) >= sevenDaysAgo);
  const recentThirty = activeReviews.filter((review) => new Date(review.reviewedAt) >= thirtyDaysAgo);
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

  const categoryInsights = [...new Set(products.map((product) => product.category))].map((category) => {
    const categoryProducts = products.filter((product) => product.category === category);
    const productIds = new Set(categoryProducts.map((product) => product.id));
    const categoryQuestions = questions.filter((question) => productIds.has(question.productId));
    const questionIds = new Set(categoryQuestions.map((question) => question.id));
    const categoryReviews = activeReviews.filter((review) => questionIds.has(review.questionId));
    const learned = new Set(categoryReviews.map((review) => review.questionId)).size;
    const mastery = categoryProducts.length
      ? Math.round(categoryProducts.reduce((sum, product) => sum + productMastery(product.id, questions, progress), 0) / categoryProducts.length)
      : 0;
    return {
      category,
      productCount: categoryProducts.length,
      questionCount: categoryQuestions.length,
      learnedQuestions: learned,
      attempts: categoryReviews.length,
      securePercent: percentage(categoryReviews),
      mastery,
    };
  }).sort((a, b) => Number(b.attempts > 0) - Number(a.attempts > 0)
    || a.mastery - b.mastery
    || b.attempts - a.attempts
    || a.category.localeCompare(b.category, 'cs'));

  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (6 - index));
    const day = localDay(date.toISOString());
    const dayReviews = activeReviews.filter((review) => localDay(review.reviewedAt) === day);
    return {
      day,
      label: new Intl.DateTimeFormat('cs-CZ', { weekday: 'short', timeZone: 'Europe/Prague' }).format(date).replace('.', ''),
      reviews: dayReviews.length,
      securePercent: percentage(dayReviews),
    };
  });

  const confusionMap = new Map();
  activeReviews.filter((review) => review.mode === 'comparison'
    && review.wasCorrect === false
    && review.selectedAnswer
    && review.correctAnswer).forEach((review) => {
    const names = [String(review.selectedAnswer), String(review.correctAnswer)].sort((a, b) => a.localeCompare(b, 'cs'));
    const key = names.join('\u0000');
    const current = confusionMap.get(key) || { products: names, count: 0 };
    current.count += 1;
    confusionMap.set(key, current);
  });
  const confusedPairs = [...confusionMap.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  const recentMistakes = [...activeReviews].reverse()
    .filter((review) => review.wasCorrect === false || (review.wasCorrect == null && review.rating === RATINGS.AGAIN))
    .slice(0, 5);

  return {
    totalReviews: activeReviews.length,
    recentReviews: recent.length,
    overallSecurePercent: percentage(activeReviews),
    recentSecurePercent: percentage(recent),
    thirtyDayReviews: recentThirty.length,
    thirtyDaySecurePercent: percentage(recentThirty),
    learnedQuestions: learnedQuestionIds.size,
    totalQuestions: questions.length,
    weakProducts,
    categoryInsights,
    dailyTrend,
    confusedPairs,
    recentMistakes,
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
  const typeOrder = ['text', 'mcq', 'photo', 'flashcard'];
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
  return ({
    [RATINGS.AGAIN]: 'Nevěděl jsem',
    [RATINGS.HARD]: 'Vzpomněl jsem si těžko',
    [RATINGS.GOOD]: 'Věděl jsem',
    [RATINGS.EASY]: 'Bylo to snadné',
  })[rating];
}
