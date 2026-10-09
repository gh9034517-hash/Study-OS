import type { AppData, Subject } from './types';
import { addDays, daysBetween, fmt, lastNDays, toDateKey, weekStartKey } from './date';
import { dueCards } from './srs';
import type { RouteName } from './router';

export const subjectName = (subjects: Subject[], id: string | undefined) =>
  subjects.find((s) => s.id === id)?.name ?? 'Sem matéria';

// ── Tempo de estudo ─────────────────────────────────────────────────────
export function minutesByDay(data: AppData, days: number): { key: string; minutes: number }[] {
  const keys = lastNDays(days);
  const map = new Map(keys.map((k) => [k, 0]));
  for (const s of data.sessions) {
    if (s.status === 'concluida' && map.has(s.date)) map.set(s.date, map.get(s.date)! + s.minutes);
  }
  return keys.map((key) => ({ key, minutes: map.get(key)! }));
}

export function minutesOn(data: AppData, key = toDateKey()): number {
  return data.sessions.filter((s) => s.status === 'concluida' && s.date === key).reduce((a, s) => a + s.minutes, 0);
}

export function streak(data: AppData): number {
  const days = new Set(data.sessions.filter((s) => s.status === 'concluida' && s.minutes > 0).map((s) => s.date));
  let count = 0;
  let cursor = new Date();
  if (!days.has(toDateKey(cursor))) cursor = addDays(cursor, -1); // o dia de hoje ainda pode ser completado
  while (days.has(toDateKey(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// ── Desempenho ──────────────────────────────────────────────────────────
export interface AnswerEvent {
  subject: string;
  topic: string;
  correct: boolean;
  date: string; // ISO
  kind: 'quiz' | 'flashcard';
}

export function answerEvents(data: AppData): AnswerEvent[] {
  const events: AnswerEvent[] = [];
  for (const a of data.attempts) {
    for (const q of a.questions) {
      events.push({ subject: a.subject, topic: q.topic || a.topic || 'Geral', correct: q.chosen === q.answer, date: a.date, kind: 'quiz' });
    }
  }
  const cards = new Map(data.cards.map((c) => [c.id, c]));
  for (const r of data.reviews) {
    const card = cards.get(r.cardId);
    if (!card) continue;
    events.push({ subject: subjectName(data.subjects, card.subjectId), topic: card.topic || 'Geral', correct: r.grade > 0, date: r.date, kind: 'flashcard' });
  }
  return events;
}

export interface TopicStat {
  subject: string;
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  recentAccuracy: number | null; // últimos 14 dias
  previousAccuracy: number | null; // antes disso
  lastDate: string;
}

export function topicStats(events: AnswerEvent[]): TopicStat[] {
  const cutoff = addDays(new Date(), -14).toISOString();
  const groups = new Map<string, AnswerEvent[]>();
  for (const e of events) {
    const key = `${e.subject}␟${e.topic.trim().toLowerCase()}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
  }
  return [...groups.values()].map((list) => {
    const correct = list.filter((e) => e.correct).length;
    const recent = list.filter((e) => e.date >= cutoff);
    const prev = list.filter((e) => e.date < cutoff);
    const acc = (l: AnswerEvent[]) => (l.length ? l.filter((e) => e.correct).length / l.length : null);
    return {
      subject: list[0].subject,
      topic: list[0].topic,
      attempts: list.length,
      correct,
      accuracy: correct / list.length,
      recentAccuracy: acc(recent),
      previousAccuracy: acc(prev),
      lastDate: list.reduce((m, e) => (e.date > m ? e.date : m), ''),
    };
  });
}

export function subjectStats(events: AnswerEvent[]) {
  const map = new Map<string, { subject: string; attempts: number; correct: number }>();
  for (const e of events) {
    const s = map.get(e.subject) ?? { subject: e.subject, attempts: 0, correct: 0 };
    s.attempts++;
    if (e.correct) s.correct++;
    map.set(e.subject, s);
  }
  return [...map.values()].map((s) => ({ ...s, accuracy: s.correct / s.attempts })).sort((a, b) => a.accuracy - b.accuracy);
}

export function weakTopics(stats: TopicStat[], minAttempts = 3): TopicStat[] {
  return stats
    .filter((s) => s.attempts >= minAttempts && s.accuracy < 0.7)
    .sort((a, b) => (1 - b.accuracy) * Math.log(b.attempts + 1) - (1 - a.accuracy) * Math.log(a.attempts + 1));
}

/** Acerto semanal das últimas N semanas (somente semanas com respostas registradas). */
export function weeklyAccuracy(events: AnswerEvent[], weeks = 8) {
  const start = weekStartKey(addDays(new Date(), -7 * (weeks - 1)));
  const keys = Array.from({ length: weeks }, (_, i) => toDateKey(addDays(new Date(start + 'T00:00:00'), i * 7)));
  const map = new Map(keys.map((k) => [k, { total: 0, correct: 0 }]));
  for (const e of events) {
    const k = weekStartKey(new Date(e.date));
    const w = map.get(k);
    if (w) {
      w.total++;
      if (e.correct) w.correct++;
    }
  }
  return keys.map((key) => {
    const w = map.get(key)!;
    return { key, label: fmt.dayMonth(key), total: w.total, accuracy: w.total ? w.correct / w.total : null };
  });
}

// ── Recomendações ───────────────────────────────────────────────────────
export interface Recommendation {
  id: string;
  tone: 'urgent' | 'focus' | 'good';
  title: string;
  detail: string;
  action?: { route: RouteName; label: string; params?: Record<string, string> };
}

export function recommendations(data: AppData): Recommendation[] {
  const today = toDateKey();
  const recs: Recommendation[] = [];

  for (const exam of data.exams) {
    const days = daysBetween(today, exam.date);
    if (days >= 0 && days <= 14) {
      recs.push({
        id: `exam-${exam.id}`,
        tone: days <= 3 ? 'urgent' : 'focus',
        title: `${exam.title} ${fmt.relativeDays(days)}`,
        detail: `${subjectName(data.subjects, exam.subjectId)}${exam.topics ? ` · ${exam.topics}` : ''}. Faça um quiz e revise os flashcards dessa matéria.`,
        action: { route: 'quiz', label: 'Treinar agora', params: { materia: subjectName(data.subjects, exam.subjectId) } },
      });
    }
  }

  const overdue = data.tasks.filter((t) => !t.done && t.due && t.due < today);
  if (overdue.length) {
    recs.push({
      id: 'overdue',
      tone: 'urgent',
      title: `${overdue.length} tarefa${overdue.length > 1 ? 's' : ''} atrasada${overdue.length > 1 ? 's' : ''}`,
      detail: overdue.slice(0, 2).map((t) => t.title).join(' · '),
      action: { route: 'plano', label: 'Ver tarefas' },
    });
  }

  const due = dueCards(data.cards);
  if (due.length) {
    recs.push({
      id: 'cards',
      tone: due.length > 20 ? 'urgent' : 'focus',
      title: `${due.length} flashcard${due.length > 1 ? 's' : ''} para revisar`,
      detail: 'A revisão no dia certo é o que fixa a memória de longo prazo.',
      action: { route: 'revisao', label: 'Revisar' },
    });
  }

  const weak = weakTopics(topicStats(answerEvents(data)));
  for (const w of weak.slice(0, 2)) {
    recs.push({
      id: `weak-${w.subject}-${w.topic}`,
      tone: 'focus',
      title: `Reforce ${w.topic}`,
      detail: `${w.subject}: ${Math.round(w.accuracy * 100)}% de acerto em ${w.attempts} respostas.`,
      action: { route: 'tutor', label: 'Estudar com o tutor', params: { materia: w.subject, assunto: w.topic } },
    });
  }

  const studied = minutesOn(data, today);
  const goal = data.profile.dailyGoalMinutes;
  if (studied >= goal && goal > 0) {
    recs.push({ id: 'goal', tone: 'good', title: 'Meta diária concluída', detail: `${fmt.minutes(studied)} estudados hoje. Ótimo ritmo!` });
  } else if (data.subjects.length) {
    recs.push({
      id: 'goal',
      tone: 'focus',
      title: `Faltam ${fmt.minutes(goal - studied)} para a meta de hoje`,
      detail: 'Inicie uma sessão de foco ou gere um plano para o tempo disponível.',
      action: { route: 'plano', label: 'Planejar hoje' },
    });
  }

  for (const s of data.subjects) {
    const last = data.sessions.filter((x) => x.subjectId === s.id && x.status === 'concluida').map((x) => x.date).sort().pop();
    const gap = last ? daysBetween(last, today) : null;
    if (gap !== null && gap >= 7) {
      recs.push({ id: `idle-${s.id}`, tone: 'focus', title: `${s.name} parada há ${gap} dias`, detail: 'Uma sessão curta evita esquecer o que já foi aprendido.' });
    }
  }

  const order = { urgent: 0, focus: 1, good: 2 };
  return recs.sort((a, b) => order[a.tone] - order[b.tone]);
}

// ── Plano diário baseado em desempenho + tempo disponível ───────────────
export interface PlanItem {
  subjectId: string;
  minutes: number;
  reasons: string[];
}

export function buildDailyPlan(data: AppData, availableMinutes: number): PlanItem[] {
  if (!data.subjects.length || availableMinutes < 10) return [];
  const today = toDateKey();
  const stats = subjectStats(answerEvents(data));
  const scored = data.subjects.map((s) => {
    const reasons: string[] = [];
    let score = 1;
    const nextExam = data.exams
      .filter((e) => e.subjectId === s.id && e.date >= today)
      .map((e) => daysBetween(today, e.date))
      .sort((a, b) => a - b)[0];
    if (nextExam !== undefined && nextExam <= 30) {
      score += 4 * (1 - nextExam / 31);
      reasons.push(`prova ${fmt.relativeDays(nextExam)}`);
    }
    const st = stats.find((x) => x.subject.toLowerCase() === s.name.toLowerCase());
    if (st && st.attempts >= 3) {
      score += 3 * (1 - st.accuracy);
      if (st.accuracy < 0.7) reasons.push(`${Math.round(st.accuracy * 100)}% de acerto`);
    }
    const pending = data.tasks.filter((t) => t.subjectId === s.id && !t.done);
    if (pending.length) {
      score += Math.min(2, pending.length * 0.5) + (pending.some((t) => t.due && t.due <= today) ? 1.5 : 0);
      reasons.push(`${pending.length} tarefa${pending.length > 1 ? 's' : ''} pendente${pending.length > 1 ? 's' : ''}`);
    }
    const dueCount = dueCards(data.cards.filter((c) => c.subjectId === s.id)).length;
    if (dueCount) {
      score += Math.min(1.5, dueCount / 10);
      reasons.push(`${dueCount} flashcards vencidos`);
    }
    const last = data.sessions.filter((x) => x.subjectId === s.id && x.status === 'concluida').map((x) => x.date).sort().pop();
    const gap = last ? daysBetween(last, today) : 14;
    score += Math.min(2, gap / 7);
    if (gap >= 5) reasons.push(last ? `sem estudo há ${gap} dias` : 'ainda não estudada');
    if (!reasons.length) reasons.push('manutenção do ritmo');
    return { subjectId: s.id, score, reasons };
  });

  // Blocos de 25 min (pomodoro); no máximo 4 matérias por dia para manter o foco.
  const blocks = Math.max(1, Math.floor(availableMinutes / 25));
  const chosen = scored.sort((a, b) => b.score - a.score).slice(0, Math.min(4, blocks));
  const total = chosen.reduce((a, c) => a + c.score, 0);
  let remaining = blocks;
  const plan = chosen.map((c) => {
    const n = Math.max(1, Math.round((c.score / total) * blocks));
    return { ...c, n };
  });
  // Ajusta arredondamentos para caber exatamente no tempo.
  for (const p of plan) {
    p.n = Math.min(p.n, remaining - (plan.length - plan.indexOf(p) - 1));
    remaining -= p.n;
  }
  if (remaining > 0) plan[0].n += remaining;
  const minutesPerBlock = availableMinutes / blocks;
  return plan.filter((p) => p.n > 0).map((p) => ({ subjectId: p.subjectId, minutes: Math.round(p.n * minutesPerBlock), reasons: p.reasons }));
}
