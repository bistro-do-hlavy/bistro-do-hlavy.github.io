import { createEmptyCard, fsrs, Rating } from 'https://cdn.jsdelivr.net/npm/ts-fsrs@5.4.2/+esm';

const scheduler = fsrs();

export const RATINGS = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });

const hydrateCard = (card) => ({
  ...card,
  due: new Date(card.due),
  last_review: card.last_review ? new Date(card.last_review) : undefined,
});

const serializeCard = (card) => ({
  ...card,
  due: new Date(card.due).toISOString(),
  last_review: card.last_review ? new Date(card.last_review).toISOString() : null,
});

export function createInitialProgress(now = new Date()) {
  return serializeCard(createEmptyCard(now));
}

export function schedule(progress, rating, now = new Date()) {
  const card = progress ? hydrateCard(progress) : createEmptyCard(now);
  const result = scheduler.next(card, now, rating);
  return serializeCard(result.card);
}

export function rebuildProgress(reviews, now = new Date()) {
  let card = createEmptyCard(reviews[0]?.reviewedAt ? new Date(reviews[0].reviewedAt) : now);
  for (const review of [...reviews].sort((a, b) => a.reviewedAt.localeCompare(b.reviewedAt))) {
    card = scheduler.next(card, new Date(review.reviewedAt), review.rating).card;
  }
  return serializeCard(card);
}

export function getIntervals(progress, now = new Date()) {
  const card = progress ? hydrateCard(progress) : createEmptyCard(now);
  const preview = scheduler.repeat(card, now);
  return {
    [RATINGS.AGAIN]: preview[Rating.Again].card.due,
    [RATINGS.HARD]: preview[Rating.Hard].card.due,
    [RATINGS.GOOD]: preview[Rating.Good].card.due,
    [RATINGS.EASY]: preview[Rating.Easy].card.due,
  };
}
