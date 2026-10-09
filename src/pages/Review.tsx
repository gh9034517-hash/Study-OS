import { useEffect, useMemo, useRef, useState } from 'react';
import { setData, useData } from '../lib/store';
import { difficulty, dueCards, newCard, previewInterval, schedule, type Grade } from '../lib/srs';
import { subjectName } from '../lib/analytics';
import { fmt } from '../lib/date';
import { uid } from '../lib/id';
import { api, AIRequestError } from '../lib/api';
import { subjectColor } from '../lib/subjects';
import type { Flashcard, Level } from '../lib/types';
import { PageHero } from '../components/Decor';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { AIStatusBanner } from '../components/AIStatus';
import { useFeedback } from '../components/Feedback';

type Tab = 'revisar' | 'cartoes' | 'criar';

const GRADES: { grade: Grade; label: string; cls: string }[] = [
  { grade: 0, label: 'Errei', cls: 'g0' },
  { grade: 1, label: 'Difícil', cls: 'g1' },
  { grade: 2, label: 'Bom', cls: 'g2' },
  { grade: 3, label: 'Fácil', cls: 'g3' },
];

export default function Review() {
  const data = useData();
  const due = dueCards(data.cards);
  const [tab, setTab] = useState<Tab>(data.cards.length ? 'revisar' : 'criar');
  const totalReviews = data.reviews.length;
  const correctReviews = data.reviews.filter((r) => r.grade > 0).length;
  const learned = data.cards.filter((c) => c.interval >= 21).length;

  return (
    <div className="page review-page">
      <div className="wrap">
        <PageHero
          num="05"
          label="Revisão inteligente"
          ghost="MEMÓRIA"
          title={
            <>
              Lembre <em>no momento</em> certo.
            </>
          }
          lead="Flashcards com repetição espaçada: cada resposta reagenda o cartão, e os conteúdos em que você mais erra aparecem primeiro."
        />
        <dl className="review-stats">
          <div className="stat">
            <dt className="stat-label">Para hoje</dt>
            <dd className="stat-value">{due.length}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Cartões</dt>
            <dd className="stat-value">{data.cards.length}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Acerto nas revisões</dt>
            <dd className="stat-value">
              {totalReviews ? Math.round((correctReviews / totalReviews) * 100) : '—'}
              {totalReviews > 0 && <small>%</small>}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Consolidados (21d+)</dt>
            <dd className="stat-value">{learned}</dd>
          </div>
        </dl>

        <div className="tabs view-tabs" role="tablist" aria-label="Seções da revisão">
          {(
            [
              ['revisar', `Revisar (${due.length})`],
              ['cartoes', 'Meus cartões'],
              ['criar', 'Criar cartões'],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="tab-panel">
          {tab === 'revisar' ? <ReviewSession onCreate={() => setTab('criar')} /> : tab === 'cartoes' ? <CardList /> : <CreateCards onCreated={() => setTab('revisar')} />}
        </div>
      </div>
    </div>
  );
}

// ── Sessão de revisão ──────────────────────────────────────────────────
function ReviewSession({ onCreate }: { onCreate: () => void }) {
  const data = useData();
  const [subject, setSubject] = useState('');
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Grade[]>([]);
  const frontRef = useRef<HTMLDivElement>(null);

  const pool = useMemo(() => data.cards.filter((c) => !subject || c.subjectId === subject), [data.cards, subject]);
  const due = dueCards(pool);
  const currentId = queue?.[0];
  const card = data.cards.find((c) => c.id === currentId);

  const start = (ids: string[]) => {
    setQueue(ids);
    setResults([]);
    setRevealed(false);
  };

  const grade = (g: Grade) => {
    if (!card) return;
    const updated = schedule(card, g);
    setData((d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === card.id ? updated : c)),
      reviews: [...d.reviews, { id: uid(), cardId: card.id, date: new Date().toISOString(), grade: g }],
    }));
    setResults((r) => [...r, g]);
    setRevealed(false);
    // Cartões errados voltam ao fim da fila desta sessão.
    setQueue((q) => (q ? [...q.slice(1), ...(g === 0 ? [card.id] : [])] : q));
  };

  useEffect(() => {
    frontRef.current?.focus();
  }, [currentId]);

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if ((e.key === ' ' || e.key === 'Enter') && !revealed && t.tagName !== 'BUTTON') {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        grade((Number(e.key) - 1) as Grade);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!data.cards.length) {
    return (
      <div className="empty">
        <strong>Nenhum flashcard ainda</strong>
        <span>Crie cartões manualmente, gere com IA ou transforme os erros de um quiz em cartões.</span>
        <button type="button" className="btn btn-primary btn-sm" onClick={onCreate}>
          Criar cartões
        </button>
      </div>
    );
  }

  if (queue && card) {
    const total = results.length + queue.length;
    return (
      <section className="flash-session" aria-label="Sessão de revisão">
        <div className="quiz-progress">
          <span>
            {results.length} revisados · {queue.length} restantes
          </span>
          <div className="meter" aria-hidden="true">
            <i style={{ width: `${(results.length / total) * 100}%` }} />
          </div>
        </div>
        <div className={`flashcard${revealed ? ' revealed' : ''}`}>
          <div className="flash-meta">
            <span className="subject-dot" style={{ background: subjectColor(data.subjects.find((s) => s.id === card.subjectId)?.hue) }} />
            {subjectName(data.subjects, card.subjectId)} · {card.topic}
            {card.wrong > 0 && <span className="chip bad">{card.wrong} erro{card.wrong > 1 ? 's' : ''}</span>}
          </div>
          <div className="flash-front" ref={frontRef} tabIndex={-1}>
            {card.front}
          </div>
          {revealed ? (
            <div className="flash-back" role="status">
              {card.back}
            </div>
          ) : (
            <button type="button" className="btn btn-ice reveal-btn" onClick={() => setRevealed(true)}>
              Mostrar resposta <kbd>Espaço</kbd>
            </button>
          )}
        </div>
        {revealed && (
          <div className="grade-row" role="group" aria-label="Como foi lembrar?">
            {GRADES.map((g) => (
              <button key={g.grade} type="button" className={`grade-btn ${g.cls}`} onClick={() => grade(g.grade)}>
                <strong>{g.label}</strong>
                <small>{previewInterval(card, g.grade)}</small>
                <kbd>{g.grade + 1}</kbd>
              </button>
            ))}
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-sm" onClick={() => setQueue(null)}>
            Encerrar sessão
          </button>
        </div>
      </section>
    );
  }

  if (queue && !card && results.length) {
    const ok = results.filter((r) => r > 0).length;
    return (
      <div className="panel-electric session-done">
        <p className="result-score">{results.length}</p>
        <p>
          revisões concluídas · {Math.round((ok / results.length) * 100)}% lembradas. Os cartões foram reagendados automaticamente.
        </p>
        <button type="button" className="btn btn-ice" onClick={() => setQueue(null)}>
          Voltar
        </button>
      </div>
    );
  }

  const hardest = [...pool].filter((c) => !due.includes(c)).sort((a, b) => difficulty(b) - difficulty(a)).slice(0, 10);

  return (
    <div className="review-start">
      <div className="filters">
        <label className="field">
          <span className="sr-only">Matéria</span>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filtrar por matéria">
            <option value="">Todas as matérias</option>
            {data.subjects
              .filter((s) => data.cards.some((c) => c.subjectId === s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="review-start-grid">
        <div className="panel">
          <p className="stat-label">Vencidos agora</p>
          <p className="stat-value">{due.length}</p>
          <p className="muted-text">Ordenados por dificuldade: primeiro os que você mais erra.</p>
          <button type="button" className="btn btn-primary" disabled={!due.length} onClick={() => start(due.slice(0, 50).map((c) => c.id))}>
            <Icon name="play" size={16} /> Começar revisão
          </button>
        </div>
        <div className="panel">
          <p className="stat-label">Treino extra</p>
          <p className="stat-value">{hardest.length}</p>
          <p className="muted-text">{due.length ? 'Depois da revisão do dia, ' : 'Nada vencido. '}pratique os cartões mais difíceis antecipadamente.</p>
          <button type="button" className="btn" disabled={!hardest.length} onClick={() => start(hardest.map((c) => c.id))}>
            Treinar os mais difíceis
          </button>
        </div>
      </div>
      {!due.length && (
        <p className="muted-text" style={{ marginTop: 16 }}>
          Próxima revisão: {pool.length ? fmt.full([...pool].sort((a, b) => a.due.localeCompare(b.due))[0].due) : '—'}
        </p>
      )}
    </div>
  );
}

// ── Lista de cartões ───────────────────────────────────────────────────
function CardList() {
  const data = useData();
  const { confirm, toast } = useFeedback();
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [sort, setSort] = useState<'dificuldade' | 'proxima' | 'recentes'>('dificuldade');
  const [editing, setEditing] = useState<Flashcard | null>(null);

  const list = useMemo(() => {
    const filtered = data.cards.filter(
      (c) => (!subject || c.subjectId === subject) && (!q || `${c.front} ${c.back} ${c.topic}`.toLowerCase().includes(q.toLowerCase())),
    );
    return filtered.sort((a, b) =>
      sort === 'dificuldade' ? difficulty(b) - difficulty(a) : sort === 'proxima' ? a.due.localeCompare(b.due) : b.createdAt.localeCompare(a.createdAt),
    );
  }, [data.cards, q, subject, sort]);

  if (!data.cards.length) return <div className="empty"><strong>Nenhum cartão</strong><span>Crie seus primeiros flashcards na aba “Criar cartões”.</span></div>;

  return (
    <>
      <div className="filters">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar cartões</span>
          <input className="input" type="search" placeholder="Buscar nos cartões…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filtrar por matéria">
          <option value="">Todas as matérias</option>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
          <option value="dificuldade">Mais difíceis primeiro</option>
          <option value="proxima">Próxima revisão</option>
          <option value="recentes">Mais recentes</option>
        </select>
      </div>
      <p className="muted-text" style={{ marginBottom: 8 }}>
        {list.length} cartão(ões)
      </p>
      <ul className="rows">
        {list.map((c) => {
          const total = c.correct + c.wrong;
          return (
            <li key={c.id} className="row">
              <span className="subject-dot" style={{ background: subjectColor(data.subjects.find((s) => s.id === c.subjectId)?.hue) }} />
              <div>
                <p className="row-title">{c.front}</p>
                <p className="row-meta">
                  <span>{subjectName(data.subjects, c.subjectId)} · {c.topic}</span>
                  <span>{total ? `${c.correct}✓ ${c.wrong}✗` : 'nunca revisado'}</span>
                  <span>próxima: {new Date(c.due) <= new Date() ? 'agora' : fmt.full(c.due)}</span>
                  <span className="chip">{c.source === 'ia' ? 'IA' : c.source === 'quiz' ? 'Do quiz' : 'Manual'}</span>
                </p>
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-sm btn-icon" aria-label="Editar cartão" onClick={() => setEditing(c)}>
                  <Icon name="edit" size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-icon"
                  aria-label="Excluir cartão"
                  onClick={async () => {
                    if (await confirm({ title: 'Excluir cartão?', message: 'O cartão e seu histórico de revisões serão removidos.', confirmLabel: 'Excluir', danger: true })) {
                      setData((d) => ({ ...d, cards: d.cards.filter((x) => x.id !== c.id), reviews: d.reviews.filter((r) => r.cardId !== c.id) }));
                      toast('Cartão excluído.');
                    }
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing && (
        <Modal title="Editar cartão" onClose={() => setEditing(null)}>
          <CardForm
            initial={editing}
            submitLabel="Salvar"
            onCancel={() => setEditing(null)}
            onSubmit={(v) => {
              setData((d) => ({ ...d, cards: d.cards.map((x) => (x.id === editing.id ? { ...x, ...v } : x)) }));
              setEditing(null);
              toast('Cartão atualizado.');
            }}
          />
        </Modal>
      )}
    </>
  );
}

function CardForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Flashcard>;
  submitLabel: string;
  onSubmit: (v: { subjectId: string; topic: string; front: string; back: string }) => void;
  onCancel?: () => void;
}) {
  const data = useData();
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? data.subjects[0]?.id ?? '');
  const [topic, setTopic] = useState(initial?.topic ?? '');
  const [front, setFront] = useState(initial?.front ?? '');
  const [back, setBack] = useState(initial?.back ?? '');
  const [error, setError] = useState('');
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!subjectId) return setError('Cadastre uma matéria no Plano antes de criar cartões.');
        if (!front.trim() || !back.trim()) return setError('Preencha a frente e o verso.');
        onSubmit({ subjectId, topic: topic.trim().slice(0, 80) || 'Geral', front: front.trim().slice(0, 400), back: back.trim().slice(0, 800) });
        if (!initial) {
          setFront('');
          setBack('');
          setError('');
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          <span>Matéria</span>
          <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Assunto</span>
          <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} placeholder="Ex.: Citologia" />
        </label>
      </div>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Frente (pergunta)</span>
        <textarea className="textarea" value={front} onChange={(e) => setFront(e.target.value)} maxLength={400} data-autofocus />
      </label>
      <label className="field" style={{ marginTop: 14 }}>
        <span>Verso (resposta)</span>
        <textarea className="textarea" value={back} onChange={(e) => setBack(e.target.value)} maxLength={800} />
      </label>
      {error && (
        <p className="field-error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="btn btn-primary">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Criação manual e com IA ────────────────────────────────────────────
function CreateCards({ onCreated }: { onCreated: () => void }) {
  const data = useData();
  const { toast } = useFeedback();
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? '');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(8);
  const [level, setLevel] = useState<Level>(data.profile.level);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AIRequestError | null>(null);
  const [preview, setPreview] = useState<{ front: string; back: string; topic: string; keep: boolean }[] | null>(null);

  if (!data.subjects.length) {
    return (
      <div className="empty">
        <strong>Cadastre uma matéria primeiro</strong>
        <span>Os flashcards são organizados por matéria. Adicione matérias no Plano de estudos.</span>
        <a className="btn btn-primary btn-sm" href="#/plano?aba=materias">
          Ir para matérias
        </a>
      </div>
    );
  }

  const generate = async () => {
    const s = data.subjects.find((x) => x.id === subjectId);
    if (!s) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.flashcards({ subject: s.name, topic: topic.trim() || undefined, level, count });
      setPreview(res.cards.map((c) => ({ ...c, keep: true })));
    } catch (err) {
      setError(err instanceof AIRequestError ? err : new AIRequestError('network', 'Falha ao gerar flashcards.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-grid">
      <section className="panel">
        <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 16 }}>
          Criar <em>manualmente</em>
        </h2>
        <CardForm
          submitLabel="Adicionar cartão"
          onSubmit={(v) => {
            setData((d) => ({ ...d, cards: [...d.cards, newCard({ ...v, source: 'manual' })] }));
            toast('Cartão adicionado.');
          }}
        />
      </section>
      <section className="panel">
        <h2 className="section-title" style={{ fontSize: '1.1rem', marginBottom: 16 }}>
          Gerar com <em>IA</em>
        </h2>
        <AIStatusBanner feature="a geração de flashcards" />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
          aria-busy={loading}
        >
          <div className="form-grid" style={{ marginTop: 12 }}>
            <label className="field">
              <span>Matéria</span>
              <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Assunto</span>
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={120} placeholder="Ex.: Revolução Francesa" />
            </label>
            <label className="field">
              <span>Nível</span>
              <select className="select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </label>
            <label className="field">
              <span>Quantidade</span>
              <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[5, 8, 10, 15].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && (
            <div className="alert error" role="alert" style={{ marginTop: 14 }}>
              <span aria-hidden="true">⚠</span>
              <div className="alert-body">
                <strong>{error.message}</strong>
                {error.offlineSuggested && <span>Você ainda pode criar cartões manualmente ao lado.</span>}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : <Icon name="spark" size={16} />} {loading ? 'Gerando…' : 'Gerar sugestões'}
            </button>
          </div>
        </form>
        {preview && (
          <div className="ai-preview">
            <p className="field-label">Revise antes de salvar ({preview.filter((p) => p.keep).length} selecionados)</p>
            <ul className="rows">
              {preview.map((p, i) => (
                <li key={i} className="row">
                  <input
                    type="checkbox"
                    className="check"
                    checked={p.keep}
                    aria-label={`Manter cartão: ${p.front}`}
                    onChange={() => setPreview((list) => list!.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                  />
                  <div>
                    <p className="row-title">{p.front}</p>
                    <p className="row-meta">{p.back}</p>
                  </div>
                  <span className="chip">{p.topic}</span>
                </li>
              ))}
            </ul>
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setPreview(null)}>
                Descartar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!preview.some((p) => p.keep)}
                onClick={() => {
                  const cards = preview.filter((p) => p.keep).map((p) => newCard({ subjectId, topic: p.topic || topic || 'Geral', front: p.front, back: p.back, source: 'ia' }));
                  setData((d) => ({ ...d, cards: [...d.cards, ...cards] }));
                  setPreview(null);
                  toast(`${cards.length} cartões salvos.`);
                  onCreated();
                }}
              >
                Salvar selecionados
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
