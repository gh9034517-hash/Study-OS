import { useEffect, useMemo, useRef, useState } from 'react';
import { setData, useData } from '../lib/store';
import { useRoute } from '../lib/router';
import { api, AIRequestError } from '../lib/api';
import { uid } from '../lib/id';
import { fmt } from '../lib/date';
import { newCard } from '../lib/srs';
import type { AnsweredQuestion, AppData, Level, QuizAttempt } from '../lib/types';
import type { QuizQuestion } from '../../shared/api';
import { BANK_AREAS, pickLocalQuestions, QUESTION_BANK, shuffleOptions } from '../data/questionBank';
import { PageHero } from '../components/Decor';
import { Icon } from '../components/Icon';
import { AIStatusBanner, useAIStatus } from '../components/AIStatus';
import { useFeedback } from '../components/Feedback';

type Stage = 'setup' | 'loading' | 'running' | 'done';
const LETTERS = ['A', 'B', 'C', 'D'];

/** Garante uma matéria com o nome dado (cria se não existir) e devolve o id. */
export function ensureSubject(name: string): string {
  let id = '';
  setData((d: AppData) => {
    const found = d.subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (found) {
      id = found.id;
      return d;
    }
    id = uid();
    return { ...d, subjects: [...d.subjects, { id, name, hue: d.subjects.length, createdAt: new Date().toISOString() }] };
  });
  return id;
}

export default function Quiz() {
  const data = useData();
  const { params } = useRoute();
  const ai = useAIStatus();
  const { toast, confirm } = useFeedback();
  const [view, setView] = useState<'novo' | 'historico'>('novo');
  const [source, setSource] = useState<'ia' | 'local'>('ia');
  const [subject, setSubject] = useState(params.get('materia') ?? data.subjects[0]?.name ?? '');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<Level>(data.profile.level);
  const [count, setCount] = useState(5);
  const [area, setArea] = useState(() => BANK_AREAS.find((a) => a.toLowerCase() === (params.get('materia') ?? '').toLowerCase()) ?? BANK_AREAS[0]);

  const [stage, setStage] = useState<Stage>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [meta, setMeta] = useState<{ subject: string; topic?: string; source: 'ia' | 'local' }>({ subject: '', source: 'ia' });
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [error, setError] = useState<AIRequestError | null>(null);
  const [savedAttempt, setSavedAttempt] = useState<QuizAttempt | null>(null);
  const startedAt = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (ai.state === 'not_configured' || ai.state === 'unreachable') setSource('local');
  }, [ai.state]);
  useEffect(() => {
    if (stage === 'running') questionRef.current?.focus();
  }, [stage, index]);

  const begin = (qs: QuizQuestion[], m: typeof meta) => {
    setQuestions(qs);
    setMeta(m);
    setIndex(0);
    setChosen(null);
    setAnswers([]);
    setSavedAttempt(null);
    startedAt.current = Date.now();
    setStage('running');
  };

  const generateAI = async () => {
    const name = subject.trim();
    if (!name) {
      setError(new AIRequestError('invalid_input', 'Informe a matéria do quiz.'));
      return;
    }
    setError(null);
    setStage('loading');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await api.quiz({ subject: name, topic: topic.trim() || undefined, level, count }, ctrl.signal);
      begin(res.questions, { subject: name, topic: topic.trim() || undefined, source: 'ia' });
    } catch (err) {
      setStage('setup');
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof AIRequestError ? err : new AIRequestError('network', 'Falha ao gerar o quiz.'));
    }
  };

  const startLocal = (forArea = area) => {
    const qs = pickLocalQuestions(forArea, count);
    begin(qs, { subject: forArea, source: 'local' });
  };

  const confirmAnswer = () => {
    if (chosen === null) return;
    setAnswers((a) => [...a, chosen]);
  };

  const answeredCurrent = answers.length > index;
  const current = questions[index];

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
    } else finish(answers);
  };

  const finish = (finalAnswers: number[]) => {
    const answered: AnsweredQuestion[] = questions.map((q, i) => ({ ...q, chosen: finalAnswers[i] }));
    const attempt: QuizAttempt = {
      id: uid(),
      date: new Date().toISOString(),
      subject: meta.subject,
      topic: meta.topic,
      source: meta.source,
      level,
      questions: answered,
      score: answered.filter((q) => q.chosen === q.answer).length,
      total: answered.length,
      durationSec: Math.round((Date.now() - startedAt.current) / 1000),
    };
    setData((d) => ({ ...d, attempts: [...d.attempts, attempt] }));
    setSavedAttempt(attempt);
    setStage('done');
  };

  const mistakesToCards = (attempt: QuizAttempt) => {
    const wrong = attempt.questions.filter((q) => q.chosen !== q.answer);
    if (!wrong.length) return;
    const subjectId = ensureSubject(attempt.subject);
    const cards = wrong.map((q) =>
      newCard({ subjectId, topic: q.topic, front: q.question, back: `${q.options[q.answer]} — ${q.explanation}`.slice(0, 800), source: 'quiz' }),
    );
    setData((d) => ({ ...d, cards: [...d.cards, ...cards] }));
    toast(`${cards.length} flashcard${cards.length > 1 ? 's' : ''} criado${cards.length > 1 ? 's' : ''} a partir dos erros.`);
  };

  // Atalhos de teclado durante o quiz: 1–4 / A–D escolhem, Enter confirma/avança.
  useEffect(() => {
    if (stage !== 'running') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const k = e.key.toLowerCase();
      const idx = ['1', '2', '3', '4'].indexOf(k) >= 0 ? Number(k) - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
      if (idx >= 0 && !answeredCurrent && idx < (current?.options.length ?? 0)) setChosen(idx);
      if (k === 'enter' && target.tagName !== 'BUTTON') {
        if (!answeredCurrent && chosen !== null) confirmAnswer();
        else if (answeredCurrent) next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="page quiz-page">
      <div className="wrap">
        <PageHero
          num="03"
          label="Quiz inteligente"
          ghost="QUIZ"
          title={
            <>
              Teste. Erre. <em>Domine.</em>
            </>
          }
          lead="Questões geradas pela IA sob medida para o seu nível, ou o banco offline quando a IA estiver indisponível. Cada resposta alimenta o diagnóstico."
        />

        {stage === 'setup' || stage === 'loading' ? (
          <>
            <div className="tabs view-tabs" role="tablist" aria-label="Seções do quiz">
              <button type="button" role="tab" className="tab" aria-selected={view === 'novo'} onClick={() => setView('novo')}>
                Novo quiz
              </button>
              <button type="button" role="tab" className="tab" aria-selected={view === 'historico'} onClick={() => setView('historico')}>
                Histórico ({data.attempts.length})
              </button>
            </div>
            {view === 'novo' ? (
              <div className="quiz-setup">
                <div className="source-switch" role="radiogroup" aria-label="Origem das questões">
                  <button type="button" role="radio" aria-checked={source === 'ia'} className={`source-card${source === 'ia' ? ' active' : ''}`} onClick={() => setSource('ia')}>
                    <Icon name="spark" size={22} />
                    <strong>Gerar com IA</strong>
                    <span>Questões inéditas sobre qualquer matéria e assunto.</span>
                  </button>
                  <button type="button" role="radio" aria-checked={source === 'local'} className={`source-card${source === 'local' ? ' active' : ''}`} onClick={() => setSource('local')}>
                    <Icon name="book" size={22} />
                    <strong>Banco offline</strong>
                    <span>{QUESTION_BANK.length} questões locais revisadas. Funciona sem internet.</span>
                  </button>
                </div>

                {source === 'ia' && <AIStatusBanner feature="o quiz" />}

                <form
                  className="panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (source === 'ia') generateAI();
                    else startLocal();
                  }}
                  aria-busy={stage === 'loading'}
                >
                  <div className="form-grid">
                    {source === 'ia' ? (
                      <>
                        <label className="field">
                          <span>Matéria</span>
                          <input className="input" list="quiz-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={80} required placeholder="Ex.: Biologia" />
                          <datalist id="quiz-subjects">
                            {data.subjects.map((s) => (
                              <option key={s.id} value={s.name} />
                            ))}
                          </datalist>
                        </label>
                        <label className="field">
                          <span>Assunto (opcional)</span>
                          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Ex.: Genética mendeliana" />
                        </label>
                        <label className="field">
                          <span>Nível</span>
                          <select className="select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                            <option value="iniciante">Iniciante</option>
                            <option value="intermediario">Intermediário</option>
                            <option value="avancado">Avançado</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <label className="field">
                        <span>Área</span>
                        <select className="select" value={area} onChange={(e) => setArea(e.target.value)}>
                          {BANK_AREAS.map((a) => (
                            <option key={a} value={a}>
                              {a} ({QUESTION_BANK.filter((q) => q.area === a).length})
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="field">
                      <span>Questões</span>
                      <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                        {[3, 5, 8, 10].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {source === 'local' && count > QUESTION_BANK.filter((q) => q.area === area).length && (
                    <p className="muted-text" style={{ marginTop: 10 }}>
                      Esta área tem {QUESTION_BANK.filter((q) => q.area === area).length} questões; todas serão usadas.
                    </p>
                  )}
                  {error && (
                    <div className="alert error" role="alert" style={{ marginTop: 16 }}>
                      <span aria-hidden="true">⚠</span>
                      <div className="alert-body">
                        <strong>{error.message}</strong>
                        {error.offlineSuggested && (
                          <div className="alert-actions">
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                const match = BANK_AREAS.find((a) => a.toLowerCase() === subject.trim().toLowerCase());
                                setSource('local');
                                setError(null);
                                if (match) {
                                  setArea(match);
                                  startLocal(match);
                                }
                              }}
                            >
                              <Icon name="book" size={14} /> Usar banco offline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="form-actions">
                    {stage === 'loading' ? (
                      <>
                        <span className="loading-note" role="status">
                          <span className="spinner" /> Gerando questões com IA…
                        </span>
                        <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button type="submit" className="btn btn-primary">
                        <Icon name={source === 'ia' ? 'spark' : 'play'} size={16} /> {source === 'ia' ? 'Gerar quiz' : 'Começar'}
                      </button>
                    )}
                  </div>
                </form>
                {stage === 'loading' && (
                  <div className="quiz-skeleton" aria-hidden="true">
                    <div className="skeleton" style={{ height: 28, width: '60%' }} />
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton" style={{ height: 52 }} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <History
                onRetake={(a) => begin(a.questions.map(shuffleOptions), { subject: a.subject, topic: a.topic, source: a.source })}
                onCards={mistakesToCards}
                onDelete={async (a) => {
                  if (await confirm({ title: 'Excluir tentativa?', message: 'Ela deixará de contar no diagnóstico e nos gráficos.', confirmLabel: 'Excluir', danger: true })) {
                    setData((d) => ({ ...d, attempts: d.attempts.filter((x) => x.id !== a.id) }));
                    toast('Tentativa excluída.');
                  }
                }}
              />
            )}
          </>
        ) : stage === 'running' && current ? (
          <section className="quiz-run" aria-label="Questão do quiz">
            <div className="quiz-progress">
              <span>
                Questão {index + 1} de {questions.length} · {meta.subject}
                {meta.source === 'local' ? ' · offline' : ' · IA'}
              </span>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answers.length} aria-label="Progresso do quiz">
                <i style={{ width: `${(answers.length / questions.length) * 100}%` }} />
              </div>
            </div>
            <div className="panel-ice question-card">
              <span className="chip">{current.topic}</span>
              <h2 ref={questionRef} tabIndex={-1} className="question-text">
                {current.question}
              </h2>
              <div className="options" role="radiogroup" aria-label="Alternativas">
                {current.options.map((opt, i) => {
                  const state = !answeredCurrent ? '' : i === current.answer ? 'correct' : i === answers[index] ? 'wrong' : 'dim';
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={(answeredCurrent ? answers[index] : chosen) === i}
                      disabled={answeredCurrent}
                      className={`option ${state} ${chosen === i && !answeredCurrent ? 'selected' : ''}`}
                      onClick={() => setChosen(i)}
                    >
                      <span className="option-letter">{LETTERS[i]}</span>
                      <span className="option-text">{opt}</span>
                      {state === 'correct' && <span className="option-flag">✓ Correta</span>}
                      {state === 'wrong' && <span className="option-flag">✗ Sua resposta</span>}
                    </button>
                  );
                })}
              </div>
              {answeredCurrent && (
                <div className={`explanation ${answers[index] === current.answer ? 'ok' : 'ko'}`} role="status">
                  <strong>{answers[index] === current.answer ? 'Você acertou!' : 'Resposta incorreta.'}</strong>
                  <p>{current.explanation}</p>
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (await confirm({ title: 'Sair do quiz?', message: 'As respostas desta tentativa não serão salvas.', confirmLabel: 'Sair' })) setStage('setup');
                  }}
                >
                  Sair
                </button>
                {!answeredCurrent ? (
                  <button type="button" className="btn btn-primary" disabled={chosen === null} onClick={confirmAnswer}>
                    Confirmar
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={next}>
                    {index + 1 < questions.length ? 'Próxima' : 'Ver resultado'} <Icon name="arrow" size={16} />
                  </button>
                )}
              </div>
              <p className="kbd-hint">Atalhos: teclas 1–4 escolhem · Enter confirma</p>
            </div>
          </section>
        ) : savedAttempt ? (
          <Result
            attempt={savedAttempt}
            onNew={() => setStage('setup')}
            onCards={() => mistakesToCards(savedAttempt)}
            onRetry={() => begin(savedAttempt.questions.filter((q) => q.chosen !== q.answer).map(shuffleOptions), { subject: savedAttempt.subject, topic: savedAttempt.topic, source: savedAttempt.source })}
          />
        ) : null}
      </div>
    </div>
  );
}

function Result({ attempt, onNew, onCards, onRetry }: { attempt: QuizAttempt; onNew: () => void; onCards: () => void; onRetry: () => void }) {
  const pct = Math.round((attempt.score / attempt.total) * 100);
  const [cardsDone, setCardsDone] = useState(false);
  const wrong = attempt.total - attempt.score;
  return (
    <section className="quiz-result" aria-label="Resultado do quiz">
      <div className="result-hero panel-electric">
        <div>
          <p className="stat-label" style={{ color: 'inherit', opacity: 0.8 }}>
            Resultado · {attempt.subject}
          </p>
          <p className="result-score">
            {attempt.score}/{attempt.total}
          </p>
          <p>
            {pct}% de acerto em {fmt.minutes(Math.max(1, attempt.durationSec / 60))}.{' '}
            {pct >= 80 ? 'Excelente domínio!' : pct >= 60 ? 'Bom caminho — revise os erros.' : 'Vale reforçar esse conteúdo com o tutor e flashcards.'}
          </p>
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-ice" onClick={onNew}>
            Novo quiz
          </button>
          {wrong > 0 && (
            <>
              <button type="button" className="btn" style={{ '--fg': 'var(--on-accent)', '--bd': 'color-mix(in srgb, var(--on-accent) 50%, transparent)' } as React.CSSProperties} onClick={onRetry}>
                Refazer erros
              </button>
              <button
                type="button"
                className="btn"
                style={{ '--fg': 'var(--on-accent)', '--bd': 'color-mix(in srgb, var(--on-accent) 50%, transparent)' } as React.CSSProperties}
                disabled={cardsDone}
                onClick={() => {
                  onCards();
                  setCardsDone(true);
                }}
              >
                {cardsDone ? 'Flashcards criados' : 'Erros → flashcards'}
              </button>
            </>
          )}
        </div>
      </div>
      <ReviewList attempt={attempt} />
    </section>
  );
}

function ReviewList({ attempt }: { attempt: QuizAttempt }) {
  return (
    <ol className="review-list">
      {attempt.questions.map((q, i) => {
        const ok = q.chosen === q.answer;
        return (
          <li key={i} className={ok ? 'ok' : 'ko'}>
            <p className="row-meta">
              <span className={`chip ${ok ? 'good' : 'bad'}`}>{ok ? '✓ Acertou' : '✗ Errou'}</span>
              <span>{q.topic}</span>
            </p>
            <p className="row-title">{q.question}</p>
            {!ok && <p className="muted-text">Sua resposta: {q.options[q.chosen] ?? '—'}</p>}
            <p>
              <strong>Correta:</strong> {q.options[q.answer]}
            </p>
            <p className="muted-text">{q.explanation}</p>
          </li>
        );
      })}
    </ol>
  );
}

function History({ onRetake, onCards, onDelete }: { onRetake: (a: QuizAttempt) => void; onCards: (a: QuizAttempt) => void; onDelete: (a: QuizAttempt) => void }) {
  const data = useData();
  const [filter, setFilter] = useState('');
  const [source, setSource] = useState<'todas' | 'ia' | 'local'>('todas');
  const [open, setOpen] = useState<string | null>(null);
  const subjects = [...new Set(data.attempts.map((a) => a.subject))].sort();
  const list = useMemo(
    () =>
      [...data.attempts]
        .reverse()
        .filter((a) => (!filter || a.subject === filter) && (source === 'todas' || a.source === source)),
    [data.attempts, filter, source],
  );

  if (!data.attempts.length) {
    return (
      <div className="empty" style={{ marginTop: 20 }}>
        <strong>Nenhum quiz realizado ainda</strong>
        <span>Seu histórico de pontuações aparecerá aqui.</span>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="filters">
        <label className="field">
          <span>Matéria</span>
          <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="preset-row" role="group" aria-label="Origem">
          {(['todas', 'ia', 'local'] as const).map((s) => (
            <button key={s} type="button" className="filter-btn" aria-pressed={source === s} onClick={() => setSource(s)}>
              {s === 'todas' ? 'Todas' : s === 'ia' ? 'IA' : 'Offline'}
            </button>
          ))}
        </div>
      </div>
      <ul className="rows">
        {list.map((a) => {
          const pct = Math.round((a.score / a.total) * 100);
          return (
            <li key={a.id} className="history-item">
              <div className="row">
                <span className={`score-badge ${pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad'}`}>{pct}%</span>
                <div>
                  <p className="row-title">
                    {a.subject}
                    {a.topic ? ` · ${a.topic}` : ''}
                  </p>
                  <p className="row-meta">
                    <span>{fmt.full(a.date)}</span>
                    <span>
                      {a.score}/{a.total} acertos
                    </span>
                    <span className="chip">{a.source === 'ia' ? 'IA' : 'Offline'}</span>
                  </p>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-sm" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                    {open === a.id ? 'Fechar' : 'Detalhes'}
                  </button>
                  <button type="button" className="btn btn-sm btn-icon" aria-label="Refazer quiz" title="Refazer" onClick={() => onRetake(a)}>
                    <Icon name="refresh" size={14} />
                  </button>
                  <button type="button" className="btn btn-sm btn-icon" aria-label="Excluir tentativa" onClick={() => onDelete(a)}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
              {open === a.id && (
                <div className="history-detail">
                  {a.score < a.total && (
                    <button type="button" className="btn btn-sm" onClick={() => onCards(a)}>
                      <Icon name="cards" size={14} /> Transformar erros em flashcards
                    </button>
                  )}
                  <ReviewList attempt={a} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!list.length && <p className="muted-text">Nenhuma tentativa com esses filtros.</p>}
    </div>
  );
}
