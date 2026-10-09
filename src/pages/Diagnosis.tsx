import { useMemo, useState } from 'react';
import { setData, useData } from '../lib/store';
import { answerEvents, minutesByDay, subjectStats, topicStats, weakTopics, weeklyAccuracy, type TopicStat } from '../lib/analytics';
import { daysBetween, fmt, toDateKey } from '../lib/date';
import { navigate } from '../lib/router';
import { api, AIRequestError } from '../lib/api';
import { PageHero, Wave } from '../components/Decor';
import { LineChart } from '../components/Charts';
import { Markdown } from '../components/Markdown';
import { Icon } from '../components/Icon';
import { AIStatusBanner } from '../components/AIStatus';

const MIN_ATTEMPTS = 3;

function status(s: { accuracy: number; attempts: number }) {
  if (s.attempts < MIN_ATTEMPTS) return { cls: '', label: 'Poucos dados', icon: '•' };
  if (s.accuracy < 0.5) return { cls: 'bad', label: 'Crítico', icon: '▼' };
  if (s.accuracy < 0.7) return { cls: 'warn', label: 'Atenção', icon: '■' };
  return { cls: 'good', label: 'Dominado', icon: '▲' };
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);

export default function Diagnosis() {
  const data = useData();
  const events = useMemo(() => answerEvents(data), [data]);
  const topics = useMemo(() => topicStats(events), [events]);
  const subjects = useMemo(() => subjectStats(events), [events]);
  const weekly = useMemo(() => weeklyAccuracy(events, 10), [events]);
  const weak = useMemo(() => weakTopics(topics, MIN_ATTEMPTS), [topics]);
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'acerto' | 'tentativas' | 'recente'>('acerto');

  const total = events.length;
  const overall = total ? events.filter((e) => e.correct).length / total : null;
  const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const recent = events.filter((e) => e.date >= cutoff);
  const previous = events.filter((e) => e.date < cutoff);
  const recentAcc = recent.length ? recent.filter((e) => e.correct).length / recent.length : null;
  const prevAcc = previous.length ? previous.filter((e) => e.correct).length / previous.length : null;
  const delta = recentAcc !== null && prevAcc !== null ? recentAcc - prevAcc : null;

  const list = useMemo(
    () =>
      topics
        .filter((t) => (!filter || t.subject === filter) && (!q || `${t.topic} ${t.subject}`.toLowerCase().includes(q.toLowerCase())))
        .sort((a, b) => (sort === 'acerto' ? a.accuracy - b.accuracy : sort === 'tentativas' ? b.attempts - a.attempts : b.lastDate.localeCompare(a.lastDate))),
    [topics, filter, q, sort],
  );

  return (
    <div className="page diagnosis-page">
      <div className="wrap">
        <PageHero
          num="06"
          label="Diagnóstico de aprendizagem"
          ghost="DADOS"
          title={
            <>
              Saiba onde <em>focar.</em>
            </>
          }
          lead="Calculado exclusivamente a partir das suas respostas reais em quizzes e flashcards. Quanto mais você pratica, mais preciso fica."
        />
        {total < 10 && (
          <div className="alert info" role="status">
            <span aria-hidden="true">ℹ</span>
            <div className="alert-body">
              <strong>{total ? `Apenas ${total} respostas registradas até agora.` : 'Ainda não há respostas registradas.'}</strong>
              <span>O diagnóstico fica confiável a partir de algumas dezenas de respostas. Faça quizzes e revise flashcards para alimentá-lo.</span>
              <div className="alert-actions">
                <button type="button" className="btn btn-sm" onClick={() => navigate('quiz')}>
                  Fazer um quiz
                </button>
              </div>
            </div>
          </div>
        )}
        <dl className="review-stats">
          <div className="stat">
            <dt className="stat-label">Respostas</dt>
            <dd className="stat-value">{total}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Acerto geral</dt>
            <dd className="stat-value">{pct(overall)}</dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Últimos 14 dias</dt>
            <dd className="stat-value">
              {pct(recentAcc)}
              {delta !== null && (
                <small className={delta >= 0 ? 'up' : 'down'}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(Math.round(delta * 100))} p.p.
                </small>
              )}
            </dd>
          </div>
          <div className="stat">
            <dt className="stat-label">Pontos fracos</dt>
            <dd className="stat-value">{weak.length}</dd>
          </div>
        </dl>
      </div>

      {total > 0 && (
        <section className="ice-zone">
          <Wave />
          <div className="wrap section">
            <div className="split">
              <div>
                <h2 className="section-title">
                  Evolução <em>no tempo</em>
                </h2>
                <p className="section-sub" style={{ marginBottom: 16 }}>
                  Taxa de acerto por semana (semanas sem respostas ficam em branco).
                </p>
                <div className="chart-card">
                  <LineChart title="Acerto semanal · 10 semanas" data={weekly.map((w) => ({ label: w.label, value: w.accuracy, n: w.total }))} />
                </div>
              </div>
              <div>
                <h2 className="section-title">
                  Por <em>matéria</em>
                </h2>
                <p className="section-sub" style={{ marginBottom: 16 }}>
                  Da menor para a maior taxa de acerto.
                </p>
                <ul className="hbars">
                  {subjects.map((s) => {
                    const st = status(s);
                    return (
                      <li key={s.subject}>
                        <div className="hbar-head">
                          <span className="hbar-label">{s.subject}</span>
                          <span className="hbar-value">
                            {pct(s.accuracy)} <small>({s.attempts})</small>
                          </span>
                        </div>
                        <div className="meter" aria-hidden="true">
                          <i style={{ width: `${s.accuracy * 100}%` }} />
                        </div>
                        <span className={`chip ${st.cls}`}>
                          <span aria-hidden="true">{st.icon}</span> {st.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
          <Wave bottom />
        </section>
      )}

      <section className="wrap section" style={{ marginTop: total > 0 ? 40 : 0 }}>
        <div className="section-head">
          <div>
            <h2 className="section-title">
              Recomendações <em>do histórico</em>
            </h2>
            <p className="section-sub">Assuntos com acerto abaixo de 70% e pelo menos {MIN_ATTEMPTS} respostas.</p>
          </div>
        </div>
        {weak.length ? (
          <ol className="weak-list">
            {weak.slice(0, 6).map((w, i) => (
              <WeakItem key={`${w.subject}-${w.topic}`} rank={i + 1} stat={w} />
            ))}
          </ol>
        ) : (
          <div className="empty">
            <strong>{total ? 'Nenhum ponto fraco identificado' : 'Sem dados ainda'}</strong>
            <span>{total ? 'Seus assuntos com dados suficientes estão acima de 70% de acerto. Continue praticando!' : 'Faça quizzes para que o diagnóstico identifique seus pontos fracos.'}</span>
          </div>
        )}
      </section>

      <section className="wrap section">
        <AIAnalysis disabled={total === 0} />
      </section>

      {topics.length > 0 && (
        <section className="wrap section">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                Todos os <em>assuntos</em>
              </h2>
              <p className="section-sub">Tendência compara os últimos 14 dias com o período anterior.</p>
            </div>
          </div>
          <div className="filters">
            <label className="search">
              <Icon name="search" size={16} />
              <span className="sr-only">Buscar assunto</span>
              <input className="input" type="search" placeholder="Buscar assunto…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por matéria">
              <option value="">Todas as matérias</option>
              {subjects.map((s) => (
                <option key={s.subject} value={s.subject}>
                  {s.subject}
                </option>
              ))}
            </select>
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar">
              <option value="acerto">Menor acerto primeiro</option>
              <option value="tentativas">Mais respondidos</option>
              <option value="recente">Mais recentes</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Assunto</th>
                  <th scope="col">Matéria</th>
                  <th scope="col">Respostas</th>
                  <th scope="col">Acerto</th>
                  <th scope="col">Tendência</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const st = status(t);
                  const trend = t.recentAccuracy !== null && t.previousAccuracy !== null ? t.recentAccuracy - t.previousAccuracy : null;
                  return (
                    <tr key={`${t.subject}-${t.topic}`}>
                      <td>{t.topic}</td>
                      <td>{t.subject}</td>
                      <td>{t.attempts}</td>
                      <td>{pct(t.accuracy)}</td>
                      <td>{trend === null ? '—' : <span className={trend >= 0 ? 'up' : 'down'}>{`${trend >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(trend * 100))} p.p.`}</span>}</td>
                      <td>
                        <span className={`chip ${st.cls}`}>
                          <span aria-hidden="true">{st.icon}</span> {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!list.length && <p className="muted-text">Nenhum assunto com esses filtros.</p>}
        </section>
      )}
    </div>
  );
}

function WeakItem({ rank, stat }: { rank: number; stat: TopicStat }) {
  const trend = stat.recentAccuracy !== null && stat.previousAccuracy !== null ? stat.recentAccuracy - stat.previousAccuracy : null;
  return (
    <li className="weak-item">
      <span className="weak-rank">{String(rank).padStart(2, '0')}</span>
      <div>
        <p className="row-title">{stat.topic}</p>
        <p className="row-meta">
          <span>{stat.subject}</span>
          <span>
            {stat.correct}/{stat.attempts} acertos ({pct(stat.accuracy)})
          </span>
          {trend !== null && <span className={trend >= 0 ? 'up' : 'down'}>{trend >= 0 ? 'melhorando' : 'piorando'} nas últimas 2 semanas</span>}
          <span>última prática {fmt.relativeDays(-daysBetween(stat.lastDate.slice(0, 10), toDateKey()))}</span>
        </p>
      </div>
      <div className="row-actions">
        <button type="button" className="btn btn-sm" onClick={() => navigate('tutor', { materia: stat.subject, assunto: stat.topic })}>
          <Icon name="spark" size={14} /> Tutor
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => navigate('quiz', { materia: stat.subject })}>
          Quiz
        </button>
      </div>
    </li>
  );
}

function AIAnalysis({ disabled }: { disabled: boolean }) {
  const data = useData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AIRequestError | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = toDateKey();
      const stats = topicStats(answerEvents(data))
        .sort((a, b) => b.attempts - a.attempts)
        .slice(0, 40)
        .map((t) => ({ subject: t.subject.slice(0, 80), topic: t.topic.slice(0, 120), attempts: t.attempts, accuracy: Number(t.accuracy.toFixed(3)) }));
      const res = await api.insights({
        level: data.profile.level,
        summary: stats,
        minutesLast7Days: minutesByDay(data, 7).reduce((a, d) => a + d.minutes, 0),
        pendingTasks: data.tasks.filter((t) => !t.done).length,
        upcomingExams: data.exams
          .filter((e) => e.date >= today)
          .slice(0, 20)
          .map((e) => ({ subject: (data.subjects.find((s) => s.id === e.subjectId)?.name ?? 'Matéria').slice(0, 80), daysLeft: daysBetween(today, e.date) })),
      });
      setData((d) => ({ ...d, insights: { text: res.analysis, date: new Date().toISOString(), model: res.model } }));
    } catch (err) {
      setError(err instanceof AIRequestError ? err : new AIRequestError('network', 'Falha ao gerar a análise.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel ai-analysis">
      <div className="section-head">
        <div>
          <h2 className="section-title">
            Análise com <em>IA</em>
          </h2>
          <p className="section-sub">Envia ao servidor apenas um resumo agregado (matérias, assuntos, taxas de acerto e prazos) — sem nome nem anotações.</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={disabled || loading} onClick={run}>
          {loading ? <span className="spinner" /> : <Icon name="spark" size={16} />} {data.insights ? 'Atualizar análise' : 'Gerar análise'}
        </button>
      </div>
      <AIStatusBanner feature="a análise" />
      {error && (
        <div className="alert error" role="alert">
          <span aria-hidden="true">⚠</span>
          <div className="alert-body">
            <strong>{error.message}</strong>
            {error.offlineSuggested && <span>As recomendações acima são calculadas localmente e continuam válidas.</span>}
          </div>
        </div>
      )}
      {data.insights ? (
        <div className="insight-body">
          <p className="row-meta">Gerada em {fmt.full(data.insights.date)} às {fmt.time(data.insights.date)} · conteúdo gerado por IA, pode conter imprecisões</p>
          <Markdown text={data.insights.text} />
        </div>
      ) : (
        !error && <p className="muted-text">{disabled ? 'Responda algumas questões para liberar a análise.' : 'Gere uma leitura do seu desempenho com um plano para os próximos 7 dias.'}</p>
      )}
    </div>
  );
}
