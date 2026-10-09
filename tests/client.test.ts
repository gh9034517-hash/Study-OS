import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, schedule, dueCards } from '../src/lib/srs.ts';
import { buildDailyPlan, answerEvents, topicStats, weakTopics } from '../src/lib/analytics.ts';
import { emptyData, normalizeData } from '../src/lib/store.ts';
import { pickLocalQuestions, QUESTION_BANK, BANK_AREAS, shuffleOptions } from '../src/data/questionBank.ts';
import { toDateKey, addDays } from '../src/lib/date.ts';
import type { AppData } from '../src/lib/types.ts';

test('SM-2: acertos aumentam intervalo, erro reinicia', () => {
  let c = newCard({ subjectId: 's', front: 'f', back: 'b', topic: 't', source: 'manual' });
  c = schedule(c, 2);
  assert.equal(c.interval, 1);
  c = schedule(c, 2);
  assert.equal(c.interval, 6);
  c = schedule(c, 2);
  assert.equal(c.interval, 15);
  c = schedule(c, 0);
  assert.equal(c.interval, 0);
  assert.equal(c.lapses, 1);
  assert.ok(c.ease < 2.5);
  assert.ok(new Date(c.due).getTime() - Date.now() < 11 * 60_000);
});

test('cartões difíceis vencidos vêm primeiro', () => {
  const past = new Date(Date.now() - 1000).toISOString();
  const easy = { ...newCard({ subjectId: 's', front: 'a', back: 'b', topic: 't', source: 'manual' }), due: past, correct: 5 };
  const hard = { ...newCard({ subjectId: 's', front: 'c', back: 'd', topic: 't', source: 'manual' }), due: past, wrong: 4, lapses: 3 };
  const future = { ...newCard({ subjectId: 's', front: 'e', back: 'f', topic: 't', source: 'manual' }), due: addDays(new Date(), 3).toISOString() };
  const due = dueCards([easy, future, hard]);
  assert.deepEqual(due.map((c) => c.front), ['c', 'a']);
});

function sample(): AppData {
  const d = emptyData();
  const today = toDateKey();
  d.subjects = [
    { id: 'm', name: 'Matemática', hue: 0, createdAt: '' },
    { id: 'h', name: 'História', hue: 1, createdAt: '' },
    { id: 'b', name: 'Biologia', hue: 2, createdAt: '' },
  ];
  d.exams = [{ id: 'e', subjectId: 'h', title: 'Prova', date: toDateKey(addDays(new Date(), 2)), topics: '' }];
  d.sessions = [{ id: 's1', subjectId: 'm', date: today, minutes: 30, status: 'concluida', source: 'manual' }];
  d.attempts = [
    {
      id: 'a',
      date: new Date().toISOString(),
      subject: 'Biologia',
      source: 'local',
      level: 'intermediario',
      score: 0,
      total: 3,
      durationSec: 60,
      questions: Array.from({ length: 3 }, () => ({ question: 'q', options: ['a', 'b', 'c', 'd'], answer: 0, chosen: 1, explanation: '', topic: 'Genética' })),
    },
  ];
  return d;
}

test('plano diário respeita o tempo disponível e prioriza prova próxima', () => {
  const plan = buildDailyPlan(sample(), 100);
  assert.equal(plan.reduce((a, p) => a + p.minutes, 0), 100);
  assert.equal(plan[0].subjectId, 'h');
  assert.ok(plan.some((p) => p.subjectId === 'b'));
  assert.deepEqual(buildDailyPlan(sample(), 5), []);
});

test('diagnóstico identifica assunto fraco a partir das respostas', () => {
  const weak = weakTopics(topicStats(answerEvents(sample())));
  assert.equal(weak.length, 1);
  assert.equal(weak[0].topic, 'Genética');
  assert.equal(weak[0].accuracy, 0);
});

test('normalizeData descarta registros corrompidos e mantém válidos', () => {
  const d = normalizeData({ profile: { name: 'Ana', level: 'xx', dailyGoalMinutes: 9999 }, subjects: [{ id: '1', name: 'A' }, { foo: 1 }, null], tasks: 'x' });
  assert.equal(d.subjects.length, 1);
  assert.equal(d.profile.level, 'intermediario');
  assert.equal(d.profile.dailyGoalMinutes, 600);
  assert.deepEqual(d.tasks, []);
  assert.throws(() => normalizeData('lixo'));
});

test('banco local: questões válidas e embaralhamento preserva a resposta', () => {
  for (const q of QUESTION_BANK) {
    assert.equal(q.options.length, 4, q.question);
    assert.ok(q.answer >= 0 && q.answer < 4);
    assert.equal(new Set(q.options).size, 4, q.question);
  }
  assert.ok(BANK_AREAS.length >= 8);
  for (let i = 0; i < 50; i++) {
    const original = QUESTION_BANK[i % QUESTION_BANK.length];
    const s = shuffleOptions(original);
    assert.equal(s.options[s.answer], original.options[original.answer]);
  }
  assert.equal(pickLocalQuestions('Física', 3).length, 3);
});
