import { useMemo, useState, type FormEvent } from 'react';
import { setData, useData } from '../lib/store';
import { answerEvents, buildDailyPlan, subjectName, subjectStats, type PlanItem } from '../lib/analytics';
import { daysBetween, fmt, toDateKey } from '../lib/date';
import { uid } from '../lib/id';
import { subjectColor } from '../lib/subjects';
import { focusTimer, useTimer } from '../lib/timer';
import type { Exam, Priority, StudySession, Subject, Task } from '../lib/types';
import { PageHero, Ribbon } from '../components/Decor';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';
import { FocusTimer } from '../components/FocusTimer';
import { useFeedback } from '../components/Feedback';
import { useRoute } from '../lib/router';

type Tab = 'tarefas' | 'provas' | 'sessoes' | 'materias';
const PRIORITY_LABEL: Record<Priority, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

export default function Planner() {
  const data = useData();
  const { params } = useRoute();
  const [tab, setTab] = useState<Tab>((params.get('aba') as Tab) || (data.subjects.length ? 'tarefas' : 'materias'));

  return (
    <div className="page planner-page">
      <div className="wrap">
        <PageHero
          num="04"
          label="Plano de estudos"
          ghost="PLANO"
          title={
            <>
              Organize o <em>tempo</em> que você tem.
            </>
          }
          lead="Matérias, tarefas, provas e sessões em um só lugar. O plano do dia é recomendado a partir do seu desempenho, dos prazos e do tempo disponível."
        />
      </div>

      <section className="wrap planner-top">
        <DailyPlan />
        <aside className="panel focus-panel" aria-label="Cronômetro de foco">
          <FocusTimer />
        </aside>
      </section>

      <Ribbon words={['Tarefas', 'Provas', 'Sessões', 'Matérias']} alt />

      <section className="wrap section">
        <div className="tabs view-tabs" role="tablist" aria-label="Seções do plano">
          {(
            [
              ['tarefas', `Tarefas (${data.tasks.filter((t) => !t.done).length})`],
              ['provas', `Provas (${data.exams.length})`],
              ['sessoes', 'Sessões'],
              ['materias', `Matérias (${data.subjects.length})`],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="tab-panel">
          {!data.subjects.length && tab !== 'materias' ? (
            <div className="empty">
              <strong>Cadastre uma matéria primeiro</strong>
              <span>Tarefas, provas e sessões são organizadas por matéria.</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setTab('materias')}>
                Ir para matérias
              </button>
            </div>
          ) : tab === 'tarefas' ? (
            <Tasks />
          ) : tab === 'provas' ? (
            <Exams />
          ) : tab === 'sessoes' ? (
            <Sessions />
          ) : (
            <Subjects />
          )}
        </div>
      </section>
    </div>
  );
}

// ── Plano do dia ───────────────────────────────────────────────────────
function DailyPlan() {
  const data = useData();
  const { toast } = useFeedback();
  const [available, setAvailable] = useState(Math.max(25, data.profile.dailyGoalMinutes));
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const today = toDateKey();
  const planned = data.sessions.filter((s) => s.date === today && s.status === 'planejada');

  return (
    <div className="panel-ice daily-plan">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div>
          <h2 className="section-title">
            Plano de <em>hoje</em>
          </h2>
          <p className="section-sub">Distribui seu tempo em blocos de foco, priorizando provas próximas, baixo acerto e pendências.</p>
        </div>
      </div>
      <form
        className="plan-form"
        onSubmit={(e) => {
          e.preventDefault();
          setPlan(buildDailyPlan(data, available));
        }}
      >
        <label className="field">
          <span>Tempo disponível hoje (min)</span>
          <input className="input" type="number" min={10} max={720} step={5} value={available} onChange={(e) => setAvailable(Math.min(720, Math.max(10, Number(e.target.value) || 10)))} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!data.subjects.length}>
          <Icon name="target" size={16} /> Recomendar
        </button>
      </form>
      {!data.subjects.length && <p className="muted-text" style={{ marginTop: 10 }}>Cadastre matérias para receber recomendações.</p>}
      {plan && (
        <div className="plan-result">
          {plan.length ? (
            <>
              <ul className="rows">
                {plan.map((p) => {
                  const s = data.subjects.find((x) => x.id === p.subjectId);
                  return (
                    <li key={p.subjectId} className="row">
                      <span className="plan-min">{p.minutes}′</span>
                      <div>
                        <p className="row-title">
                          <span className="subject-dot" style={{ background: subjectColor(s?.hue), display: 'inline-block', marginRight: 8 }} />
                          {s?.name}
                        </p>
                        <p className="row-meta">{p.reasons.join(' · ')}</p>
                      </div>
                      <span />
                    </li>
                  );
                })}
              </ul>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setPlan(null)}>
                  Descartar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const sessions: StudySession[] = plan.map((p) => ({ id: uid(), subjectId: p.subjectId, date: today, minutes: p.minutes, status: 'planejada', source: 'recomendacao', notes: p.reasons.join(' · ') }));
                    setData((d) => ({ ...d, sessions: [...d.sessions, ...sessions] }));
                    setPlan(null);
                    toast('Sessões adicionadas ao plano de hoje.');
                  }}
                >
                  Adicionar ao plano
                </button>
              </div>
            </>
          ) : (
            <p className="muted-text">Tempo insuficiente para um bloco de estudo.</p>
          )}
        </div>
      )}
      {planned.length > 0 && !plan && <PlannedToday sessions={planned} />}
    </div>
  );
}

function PlannedToday({ sessions }: { sessions: StudySession[] }) {
  const data = useData();
  const timer = useTimer();
  const { toast } = useFeedback();
  return (
    <div className="plan-result">
      <p className="field-label">Sessões planejadas para hoje</p>
      <ul className="rows">
        {sessions.map((s) => (
          <li key={s.id} className="row">
            <span className="plan-min">{s.minutes}′</span>
            <div>
              <p className="row-title">{subjectName(data.subjects, s.subjectId)}</p>
              {s.notes && <p className="row-meta">{s.notes}</p>}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-sm"
                disabled={Boolean(timer)}
                title={timer ? 'Já existe uma sessão de foco em andamento' : undefined}
                onClick={() => {
                  focusTimer.start(s.subjectId, s.minutes);
                  setData((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }));
                  toast('Cronômetro iniciado para esta sessão.');
                }}
              >
                <Icon name="play" size={12} /> Iniciar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-icon"
                aria-label="Marcar como concluída sem cronômetro"
                title="Concluir"
                onClick={() => {
                  setData((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === s.id ? { ...x, status: 'concluida', completedAt: new Date().toISOString() } : x)) }));
                  toast('Sessão concluída.');
                }}
              >
                <Icon name="check" size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Componentes de formulário ──────────────────────────────────────────
function SubjectSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const data = useData();
  return (
    <label className="field">
      <span>Matéria</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)} required>
        {data.subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function useCrud<T extends { id: string }>(key: 'tasks' | 'exams' | 'sessions' | 'subjects') {
  const { toast } = useFeedback();
  return {
    save(item: T, isNew: boolean) {
      setData((d) => {
        const list = d[key] as unknown as T[];
        return { ...d, [key]: isNew ? [...list, item] : list.map((x) => (x.id === item.id ? item : x)) };
      });
      toast(isNew ? 'Registro criado.' : 'Alterações salvas.');
    },
  };
}

// ── Tarefas ────────────────────────────────────────────────────────────
function Tasks() {
  const data = useData();
  const { confirm, toast } = useFeedback();
  const crud = useCrud<Task>('tasks');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [status, setStatus] = useState<'pendentes' | 'concluidas' | 'todas'>('pendentes');
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const today = toDateKey();

  const list = useMemo(
    () =>
      data.tasks
        .filter((t) => (status === 'todas' ? true : status === 'pendentes' ? !t.done : t.done))
        .filter((t) => !subject || t.subjectId === subject)
        .filter((t) => !q || t.title.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(a.done) - Number(b.done) || (a.due ?? '9999').localeCompare(b.due ?? '9999') || ['alta', 'media', 'baixa'].indexOf(a.priority) - ['alta', 'media', 'baixa'].indexOf(b.priority)),
    [data.tasks, status, subject, q],
  );

  return (
    <>
      <div className="filters">
        <label className="search">
          <Icon name="search" size={16} />
          <span className="sr-only">Buscar tarefas</span>
          <input className="input" type="search" placeholder="Buscar tarefa…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="field">
          <span className="sr-only">Filtrar por matéria</span>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filtrar por matéria">
            <option value="">Todas as matérias</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="preset-row" role="group" aria-label="Status">
          {(['pendentes', 'concluidas', 'todas'] as const).map((s) => (
            <button key={s} type="button" className="filter-btn" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'pendentes' ? 'Pendentes' : s === 'concluidas' ? 'Concluídas' : 'Todas'}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Nova tarefa
        </button>
      </div>
      {list.length ? (
        <ul className="rows">
          {list.map((t) => {
            const d = t.due ? daysBetween(today, t.due) : null;
            return (
              <li key={t.id} className={`row${t.done ? ' done' : ''}`}>
                <input
                  type="checkbox"
                  className="check"
                  checked={t.done}
                  aria-label={`Marcar "${t.title}" como ${t.done ? 'pendente' : 'concluída'}`}
                  onChange={() => setData((dd) => ({ ...dd, tasks: dd.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done, completedAt: !x.done ? new Date().toISOString() : undefined } : x)) }))}
                />
                <div>
                  <p className="row-title">{t.title}</p>
                  <p className="row-meta">
                    <span>{subjectName(data.subjects, t.subjectId)}</span>
                    {t.due && <span className={`chip ${!t.done && d! < 0 ? 'bad' : !t.done && d! <= 2 ? 'warn' : ''}`}>{d! < 0 && !t.done ? `atrasada ${-d!}d` : `${fmt.dayMonth(t.due)} · ${fmt.relativeDays(d!)}`}</span>}
                    <span>Prioridade {PRIORITY_LABEL[t.priority].toLowerCase()}</span>
                    <span>~{t.estimateMin} min</span>
                  </p>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-sm btn-icon" aria-label={`Editar ${t.title}`} onClick={() => setEditing(t)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    aria-label={`Excluir ${t.title}`}
                    onClick={async () => {
                      if (await confirm({ title: 'Excluir tarefa?', message: `"${t.title}" será removida.`, confirmLabel: 'Excluir', danger: true })) {
                        setData((dd) => ({ ...dd, tasks: dd.tasks.filter((x) => x.id !== t.id) }));
                        toast('Tarefa excluída.');
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
      ) : (
        <div className="empty">
          <strong>{data.tasks.length ? 'Nenhuma tarefa com esses filtros' : 'Nenhuma tarefa cadastrada'}</strong>
          <span>Tarefas com prazo entram nas recomendações e no plano do dia.</span>
        </div>
      )}
      {editing && <TaskForm task={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={(t, isNew) => crud.save(t, isNew)} />}
    </>
  );
}

function TaskForm({ task, onClose, onSave }: { task: Task | null; onClose: () => void; onSave: (t: Task, isNew: boolean) => void }) {
  const data = useData();
  const [title, setTitle] = useState(task?.title ?? '');
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? data.subjects[0]?.id ?? '');
  const [due, setDue] = useState(task?.due ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'media');
  const [estimate, setEstimate] = useState(task?.estimateMin ?? 30);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return setError('Informe o título da tarefa.');
    if (!subjectId) return setError('Escolha uma matéria.');
    onSave(
      { id: task?.id ?? uid(), title: title.trim().slice(0, 140), subjectId, due: due || undefined, priority, estimateMin: estimate, done: task?.done ?? false, createdAt: task?.createdAt ?? new Date().toISOString(), completedAt: task?.completedAt },
      !task,
    );
    onClose();
  };

  return (
    <Modal title={task ? 'Editar tarefa' : 'Nova tarefa'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label className="field">
          <span>Título</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} data-autofocus aria-invalid={Boolean(error && !title.trim())} />
        </label>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <SubjectSelect value={subjectId} onChange={setSubjectId} />
          <label className="field">
            <span>Prazo</span>
            <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="field">
            <span>Prioridade</span>
            <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </label>
          <label className="field">
            <span>Estimativa (min)</span>
            <input className="input" type="number" min={5} max={600} step={5} value={estimate} onChange={(e) => setEstimate(Math.min(600, Math.max(5, Number(e.target.value) || 5)))} />
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Provas ─────────────────────────────────────────────────────────────
function Exams() {
  const data = useData();
  const { confirm, toast } = useFeedback();
  const crud = useCrud<Exam>('exams');
  const [editing, setEditing] = useState<Exam | 'new' | null>(null);
  const today = toDateKey();
  const sorted = [...data.exams].sort((a, b) => Number(a.date < today) - Number(b.date < today) || a.date.localeCompare(b.date));

  return (
    <>
      <div className="filters">
        <p className="muted-text" style={{ flex: 1 }}>
          Provas nas próximas 2 semanas ganham prioridade nas recomendações.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Nova prova
        </button>
      </div>
      {sorted.length ? (
        <ul className="rows">
          {sorted.map((e) => {
            const d = daysBetween(today, e.date);
            const past = d < 0;
            return (
              <li key={e.id} className={`row${past ? ' done' : ''}`}>
                <span className={`date-badge${!past && d <= 3 ? ' hot' : ''}`}>
                  <b>{past ? '✓' : d}</b>
                  <small>{past ? 'feita' : d === 1 ? 'dia' : 'dias'}</small>
                </span>
                <div>
                  <p className="row-title">{e.title}</p>
                  <p className="row-meta">
                    <span>{subjectName(data.subjects, e.subjectId)}</span>
                    <span>{fmt.full(e.date)}</span>
                    {e.topics && <span>Conteúdo: {e.topics}</span>}
                  </p>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-sm btn-icon" aria-label={`Editar ${e.title}`} onClick={() => setEditing(e)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    aria-label={`Excluir ${e.title}`}
                    onClick={async () => {
                      if (await confirm({ title: 'Excluir prova?', message: `"${e.title}" será removida.`, confirmLabel: 'Excluir', danger: true })) {
                        setData((dd) => ({ ...dd, exams: dd.exams.filter((x) => x.id !== e.id) }));
                        toast('Prova excluída.');
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
      ) : (
        <div className="empty">
          <strong>Nenhuma prova cadastrada</strong>
          <span>Adicione suas provas para receber contagem regressiva e priorização automática.</span>
        </div>
      )}
      {editing && <ExamForm exam={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={(x, isNew) => crud.save(x, isNew)} />}
    </>
  );
}

function ExamForm({ exam, onClose, onSave }: { exam: Exam | null; onClose: () => void; onSave: (e: Exam, isNew: boolean) => void }) {
  const data = useData();
  const [title, setTitle] = useState(exam?.title ?? '');
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? data.subjects[0]?.id ?? '');
  const [date, setDate] = useState(exam?.date ?? '');
  const [topics, setTopics] = useState(exam?.topics ?? '');
  const [error, setError] = useState('');
  return (
    <Modal title={exam ? 'Editar prova' : 'Nova prova'} onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return setError('Informe o nome da prova.');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Informe a data da prova.');
          onSave({ id: exam?.id ?? uid(), title: title.trim().slice(0, 120), subjectId, date, topics: topics.trim().slice(0, 300) }, !exam);
          onClose();
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex.: P2 de Física" data-autofocus />
        </label>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <SubjectSelect value={subjectId} onChange={setSubjectId} />
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Conteúdo (opcional)</span>
          <textarea className="textarea" value={topics} onChange={(e) => setTopics(e.target.value)} maxLength={300} placeholder="Ex.: cinemática, leis de Newton" />
        </label>
        {error && (
          <p className="field-error" role="alert" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Sessões ────────────────────────────────────────────────────────────
function Sessions() {
  const data = useData();
  const { confirm, toast } = useFeedback();
  const crud = useCrud<StudySession>('sessions');
  const [editing, setEditing] = useState<StudySession | 'new' | null>(null);
  const [subject, setSubject] = useState('');
  const sorted = [...data.sessions]
    .filter((s) => !subject || s.subjectId === subject)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.startTime ?? '').localeCompare(a.startTime ?? ''));
  const planned = sorted.filter((s) => s.status === 'planejada').reverse();
  const done = sorted.filter((s) => s.status === 'concluida').slice(0, 60);

  const row = (s: StudySession) => (
    <li key={s.id} className="row">
      <span className="plan-min">{s.minutes}′</span>
      <div>
        <p className="row-title">{subjectName(data.subjects, s.subjectId)}</p>
        <p className="row-meta">
          <span>
            {fmt.full(s.date)}
            {s.startTime ? ` · ${s.startTime}` : ''}
          </span>
          <span className="chip">{s.source === 'timer' ? 'Cronômetro' : s.source === 'recomendacao' ? 'Recomendada' : 'Manual'}</span>
          {s.notes && <span>{s.notes}</span>}
        </p>
      </div>
      <div className="row-actions">
        {s.status === 'planejada' && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setData((d) => ({ ...d, sessions: d.sessions.map((x) => (x.id === s.id ? { ...x, status: 'concluida', completedAt: new Date().toISOString() } : x)) }));
              toast('Sessão concluída.');
            }}
          >
            Concluir
          </button>
        )}
        <button type="button" className="btn btn-sm btn-icon" aria-label="Editar sessão" onClick={() => setEditing(s)}>
          <Icon name="edit" size={14} />
        </button>
        <button
          type="button"
          className="btn btn-sm btn-icon"
          aria-label="Excluir sessão"
          onClick={async () => {
            if (await confirm({ title: 'Excluir sessão?', message: 'O tempo desta sessão deixará de contar nas estatísticas.', confirmLabel: 'Excluir', danger: true })) {
              setData((d) => ({ ...d, sessions: d.sessions.filter((x) => x.id !== s.id) }));
              toast('Sessão excluída.');
            }
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </li>
  );

  return (
    <>
      <div className="filters">
        <label className="field">
          <span className="sr-only">Filtrar por matéria</span>
          <select className="select" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filtrar por matéria">
            <option value="">Todas as matérias</option>
            {data.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          <Icon name="plus" size={16} /> Planejar ou registrar
        </button>
      </div>
      <h3 className="list-heading">Planejadas</h3>
      {planned.length ? <ul className="rows">{planned.map(row)}</ul> : <p className="muted-text">Nenhuma sessão planejada.</p>}
      <h3 className="list-heading">Concluídas</h3>
      {done.length ? <ul className="rows">{done.map(row)}</ul> : <p className="muted-text">Nenhuma sessão concluída ainda. Use o cronômetro ou registre manualmente.</p>}
      {editing && <SessionForm session={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={(x, isNew) => crud.save(x, isNew)} />}
    </>
  );
}

function SessionForm({ session, onClose, onSave }: { session: StudySession | null; onClose: () => void; onSave: (s: StudySession, isNew: boolean) => void }) {
  const data = useData();
  const [subjectId, setSubjectId] = useState(session?.subjectId ?? data.subjects[0]?.id ?? '');
  const [date, setDate] = useState(session?.date ?? toDateKey());
  const [startTime, setStartTime] = useState(session?.startTime ?? '');
  const [minutes, setMinutes] = useState(session?.minutes ?? 30);
  const [status, setStatus] = useState<StudySession['status']>(session?.status ?? 'concluida');
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [error, setError] = useState('');
  return (
    <Modal title={session ? 'Editar sessão' : 'Nova sessão'} onClose={onClose}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!date) return setError('Informe a data.');
          if (status === 'concluida' && date > toDateKey()) return setError('Uma sessão concluída não pode estar no futuro.');
          onSave(
            {
              id: session?.id ?? uid(),
              subjectId,
              date,
              startTime: startTime || undefined,
              minutes,
              status,
              source: session?.source ?? 'manual',
              notes: notes.trim().slice(0, 200) || undefined,
              completedAt: status === 'concluida' ? session?.completedAt ?? new Date().toISOString() : undefined,
            },
            !session,
          );
          onClose();
        }}
      >
        <div className="preset-row" role="radiogroup" aria-label="Tipo de sessão">
          <button type="button" role="radio" aria-checked={status === 'concluida'} className="filter-btn" onClick={() => setStatus('concluida')}>
            Já estudei (registrar)
          </button>
          <button type="button" role="radio" aria-checked={status === 'planejada'} className="filter-btn" onClick={() => setStatus('planejada')}>
            Vou estudar (planejar)
          </button>
        </div>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <SubjectSelect value={subjectId} onChange={setSubjectId} />
          <label className="field">
            <span>Data</span>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Horário</span>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label className="field">
            <span>Duração (min)</span>
            <input className="input" type="number" min={5} max={600} step={5} value={minutes} onChange={(e) => setMinutes(Math.min(600, Math.max(5, Number(e.target.value) || 5)))} />
          </label>
        </div>
        <label className="field" style={{ marginTop: 14 }}>
          <span>Anotações</span>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} placeholder="O que foi/será estudado" />
        </label>
        {error && (
          <p className="field-error" role="alert" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary">
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Matérias ───────────────────────────────────────────────────────────
function Subjects() {
  const data = useData();
  const { confirm, toast } = useFeedback();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Subject | null>(null);
  const stats = useMemo(() => subjectStats(answerEvents(data)), [data]);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 60);
    if (!n) return;
    if (data.subjects.some((s) => s.name.toLowerCase() === n.toLowerCase())) {
      toast('Essa matéria já existe.', 'error');
      return;
    }
    setData((d) => ({ ...d, subjects: [...d.subjects, { id: uid(), name: n, hue: d.subjects.length, createdAt: new Date().toISOString() }] }));
    setName('');
    toast(`Matéria "${n}" criada.`);
  };

  return (
    <>
      <form className="filters" onSubmit={add}>
        <label className="field" style={{ flex: 1 }}>
          <span className="sr-only">Nome da matéria</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nome da nova matéria" aria-label="Nome da nova matéria" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          <Icon name="plus" size={16} /> Adicionar matéria
        </button>
      </form>
      {data.subjects.length ? (
        <ul className="rows">
          {data.subjects.map((s) => {
            const minutes = data.sessions.filter((x) => x.subjectId === s.id && x.status === 'concluida').reduce((a, x) => a + x.minutes, 0);
            const st = stats.find((x) => x.subject.toLowerCase() === s.name.toLowerCase());
            const pending = data.tasks.filter((t) => t.subjectId === s.id && !t.done).length;
            return (
              <li key={s.id} className="row">
                <span className="subject-dot" style={{ background: subjectColor(s.hue), width: 14, height: 14 }} />
                <div>
                  <p className="row-title">{s.name}</p>
                  <p className="row-meta">
                    <span>{fmt.minutes(minutes)} estudados</span>
                    <span>{pending} tarefas pendentes</span>
                    <span>{st ? `${Math.round(st.accuracy * 100)}% de acerto (${st.attempts})` : 'sem respostas ainda'}</span>
                  </p>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-sm btn-icon" aria-label={`Renomear ${s.name}`} onClick={() => setEditing(s)}>
                    <Icon name="edit" size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-icon"
                    aria-label={`Excluir ${s.name}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `Excluir ${s.name}?`,
                          message: 'Também serão excluídas as tarefas, provas, sessões e flashcards dessa matéria. O histórico de quizzes é mantido.',
                          confirmLabel: 'Excluir tudo',
                          danger: true,
                        })
                      ) {
                        setData((d) => {
                          const cardIds = new Set(d.cards.filter((c) => c.subjectId === s.id).map((c) => c.id));
                          return {
                            ...d,
                            subjects: d.subjects.filter((x) => x.id !== s.id),
                            tasks: d.tasks.filter((x) => x.subjectId !== s.id),
                            exams: d.exams.filter((x) => x.subjectId !== s.id),
                            sessions: d.sessions.filter((x) => x.subjectId !== s.id),
                            cards: d.cards.filter((x) => x.subjectId !== s.id),
                            reviews: d.reviews.filter((r) => !cardIds.has(r.cardId)),
                          };
                        });
                        toast('Matéria excluída.');
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
      ) : (
        <div className="empty">
          <strong>Nenhuma matéria ainda</strong>
          <span>Comece adicionando as matérias que você estuda.</span>
        </div>
      )}
      {editing && (
        <RenameSubject
          subject={editing}
          onClose={() => setEditing(null)}
          onSave={(n) => {
            if (data.subjects.some((s) => s.id !== editing.id && s.name.toLowerCase() === n.toLowerCase())) {
              toast('Já existe uma matéria com esse nome.', 'error');
              return;
            }
            const old = editing.name;
            // Mantém o histórico de quizzes ligado à matéria renomeada.
            setData((d) => ({
              ...d,
              subjects: d.subjects.map((s) => (s.id === editing.id ? { ...s, name: n } : s)),
              attempts: d.attempts.map((a) => (a.subject === old ? { ...a, subject: n } : a)),
            }));
            setEditing(null);
            toast('Matéria renomeada.');
          }}
        />
      )}
    </>
  );
}

function RenameSubject({ subject, onClose, onSave }: { subject: Subject; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(subject.name);
  return (
    <Modal title="Renomear matéria" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim().slice(0, 60));
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} data-autofocus />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
