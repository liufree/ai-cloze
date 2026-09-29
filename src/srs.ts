import type { ReviewCard } from "./types";

/** SM-2 style: grade 0=again 1=hard 2=good 3=easy → returns the updated card (doesn't mutate the input) */
export function reviewCard(card: ReviewCard, grade: number): ReviewCard {
  const now = Date.now();
  const g = Math.max(0, Math.min(3, Math.round(grade)));
  let { interval, ease, reps, lapses } = card;

  reps += 1;
  if (g < 2) {
    // forgotten: reset the interval, increase difficulty
    lapses += 1;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (g === 2) {
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
  } else {
    // easy: accelerate
    ease = ease + 0.15;
    if (reps === 1) interval = 4;
    else if (reps === 2) interval = 7;
    else interval = Math.round(interval * ease * 1.3);
  }
  ease = Math.min(2.8, Math.max(1.3, ease));

  const mastered = g >= 2 && reps >= 2;
  return {
    ...card,
    lastGrade: g,
    interval,
    ease,
    reps,
    lapses,
    due: now + interval * 24 * 3600 * 1000,
    mastered,
  };
}

export function cardKey(path: string, term: string): string {
  return `${path}::${term}`;
}

export function isDue(card: ReviewCard, now = Date.now()): boolean {
  return card.due <= now;
}
