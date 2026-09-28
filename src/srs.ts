import type { ReviewCard } from "./types";

/** SM-2 风格：评分 0=再次 1=困难 2=良好 3=简单 → 返回更新后的卡（不改变入参） */
export function reviewCard(card: ReviewCard, grade: number): ReviewCard {
  const now = Date.now();
  const g = Math.max(0, Math.min(3, Math.round(grade)));
  let { interval, ease, reps, lapses } = card;

  reps += 1;
  if (g < 2) {
    // 遗忘：重置间隔，加大难度
    lapses += 1;
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (g === 2) {
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 3;
    else interval = Math.round(interval * ease);
  } else {
    // 简单：加速
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
