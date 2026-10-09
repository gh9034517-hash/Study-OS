import type { Flashcard } from './types';
import { uid } from './id';

// Repetição espaçada baseada no SM-2, com 4 notas:
// 0 = Errei · 1 = Difícil · 2 = Bom · 3 = Fácil
export type Grade = 0 | 1 | 2 | 3;

export function newCard(partial: Pick<Flashcard, 'subjectId' | 'front' | 'back' | 'topic' | 'source'>): Flashcard {
  const now = new Date().toISOString();
  return { id: uid(), ease: 2.5, interval: 0, reps: 0, lapses: 0, correct: 0, wrong: 0, due: now, createdAt: now, ...partial };
}

export function schedule(card: Flashcard, grade: Grade, now = new Date()): Flashcard {
  let { ease, interval, reps, lapses, correct, wrong } = card;
  if (grade === 0) {
    reps = 0;
    lapses += 1;
    wrong += 1;
    interval = 0; // volta ainda hoje (10 min)
    ease = Math.max(1.3, ease - 0.2);
  } else {
    correct += 1;
    reps += 1;
    if (reps === 1) interval = grade === 3 ? 3 : 1;
    else if (reps === 2) interval = grade === 1 ? 3 : 6;
    else interval = Math.round(interval * (grade === 1 ? 1.2 : grade === 3 ? ease * 1.3 : ease));
    ease = Math.max(1.3, ease + (grade === 1 ? -0.15 : grade === 3 ? 0.15 : 0));
    interval = Math.min(Math.max(1, interval), 365);
  }
  const due = new Date(now);
  if (interval === 0) due.setMinutes(due.getMinutes() + 10);
  else {
    due.setDate(due.getDate() + interval);
    due.setHours(4, 0, 0, 0);
  }
  return { ...card, ease: Number(ease.toFixed(2)), interval, reps, lapses, correct, wrong, due: due.toISOString(), lastReviewed: now.toISOString() };
}

/** Pontuação de dificuldade: quanto maior, mais prioritário. */
export function difficulty(card: Flashcard): number {
  const total = card.correct + card.wrong;
  const errorRate = total ? card.wrong / total : 0.5;
  return errorRate * 2 + card.lapses * 0.5 + (2.5 - card.ease);
}

export function dueCards(cards: Flashcard[], now = new Date()): Flashcard[] {
  return cards
    .filter((c) => new Date(c.due) <= now)
    .sort((a, b) => difficulty(b) - difficulty(a) || a.due.localeCompare(b.due));
}

export function previewInterval(card: Flashcard, grade: Grade): string {
  const next = schedule(card, grade);
  if (next.interval === 0) return '10 min';
  return next.interval === 1 ? '1 dia' : `${next.interval} dias`;
}
