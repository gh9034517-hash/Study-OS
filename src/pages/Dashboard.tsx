import { useMemo } from 'react';
import { useData } from '../lib/store';
import { answerEvents, minutesByDay, minutesOn, recommendations, streak, subjectName, weeklyAccuracy } from '../lib/analytics';
import { daysBetween, fmt, toDateKey } from '../lib/date';
import { href, navigate } from '../lib/router';
import { dueCards } from '../lib/srs';
import { subjectColor } from '../lib/subjects';
import { Orb, Ribbon, Wave } from '../components/Decor';
import { BarChart, LineChart } from '../components/Charts';
import { FocusTimer } from '../components/FocusTimer';
import { Icon } from '../components/Icon';

export default function Dashboard() {
  const data = useData();
  const today = toDateKey();
  const todayMin = minutesOn(data, today);
  const goal = data.profile.dailyGoalMinutes;
  const goalPct = Math.min(1, todayMin / goal);
  const pending = data.tasks.filter((t) => !t.done);
  const days = useMemo(() => minutesByDay(data, 14), [data]);
  const events = useMemo(() => answerEvents(data), [data]);
  const weekly = useMemo(() => weeklyAccuracy(events, 8), [events]);
  const recs = useMemo(() => recommendations(data), [data]);
  const recentEvents = events.filter((e) => daysBetween(e.date.slice(0, 10), today) <= 30);
  const accuracy30 = recentEvents.length ? recentEvents.filter((e) => e.correct).length / recentEvents.length : null;
  const due = dueCards(data.cards).length;
  const week = days.slice(-7).reduce((a, d) => a + d.minutes, 0);
  const total14 = days.reduce((a, d) => a + d.minutes, 0);

  const upcoming = [
    ...data.exams
      .filter((e) => e.date >= today && daysBetween(today, e.date) <= 21)
      .map((e) => ({ id: e.id, kind: 'Prova' as const, title: e.title, date: e.date, subjectId: e.subjectId })),
    ...pending
      .filter((t) => t.due && daysBetween(today, t.due) <= 7)
      .map((t) => ({ id: t.id, kind: 'Tarefa' as const, title: t.title, date: t.due!, subjectId: t.subjectId })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const subjectWeek = data.subjects
    .map((s) => ({
      ...s,
      minutes: data.sessions
        .filter((x) => x.subjectId === s.id && x.status === 'concluida' && daysBetween(x.date, today) < 7)
        .reduce((a, x) => a + x.minutes, 0),
    }))
    .sort((a, b) => b.minutes - a.minutes);

  return (
    <div className="page dashboard">
      <section className="wrap dash-hero">
        <div className="dash-hero-copy">
          <p className="eyebrow">
            <span className="num">01</span>
            {data.profile.name ? `Olá, ${data.profile.name}` : 'Seu painel'} · {fmt.full(today)}
          </p>
          <h1 className="dash-title">
            Cada sessão <br />
            <em>conta.</em> Qual é <br />a sua meta?
          </h1>
          <p className="page-lead">
            {todayMin >= goal
              ? `Meta de hoje concluída com ${fmt.minutes(todayMin)}. Use o tempo extra para revisar o que está mais difícil.`
              : `Você estudou ${fmt.minutes(todayMin)} de ${fmt.minutes(goal)} hoje. ${recs[0] ? `Próximo passo: ${recs[0].title.toLowerCase()}.` : ''}`}
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#foco">
              <Icon name="play" size={16} /> Iniciar foco
            </a>
            <a className="btn btn-ice" href={href('tutor')}>
              <Icon name="spark" size={16} /> Perguntar ao tutor
            </a>
          </div>
          <dl className="hero-stats">
            <div className="stat">
              <dt className="stat-label">Hoje (min)</dt>
              <dd className="stat-value">
                {todayMin}
                <small>/{goal}</small>
              </dd>
              <div className="meter" aria-hidden="true">
                <i style={{ width: `${goalPct * 100}%` }} />
              </div>
            </div>
            <div className="stat">
              <dt className="stat-label">Sequência</dt>
              <dd className="stat-value">
                {streak(data)}
                <small>dias</small>
              </dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Pendentes</dt>
              <dd className="stat-value">
                {pending.length}
                <small>tarefas</small>
              </dd>
            </div>
            <div className="stat">
              <dt className="stat-label">Acerto 30d</dt>
              <dd className="stat-value">
                {accuracy30 === null ? '—' : Math.round(accuracy30 * 100)}
                {accuracy30 !== null && <small>%</small>}
              </dd>
            </div>
          </dl>
        </div>

        <div className="dash-hero-visual" aria-hidden="true">
          <div className="vertical-panel">
            <span className="vertical-word solid">STUDY</span>
            <span className="vertical-word outline">OS</span>
          </div>
          <div className="hero-orb">
            <Orb size={300} />
          </div>
          <div className="goal-badge">
            <span>{Math.round(goalPct * 100)}%</span>
            <small>da meta</small>
          </div>
        </div>
      </section>

      {subjectWeek.length > 0 && (
        <div className="wrap">
          <ul className="subject-strip" aria-label="Minutos por matéria nos últimos 7 dias">
            {subjectWeek.slice(0, 6).map((s) => (
              <li key={s.id}>
                <span className="subject-dot" style={{ background: subjectColor(s.hue) }} />
                <span className="subject-strip-name">{s.name}</span>
                <strong>{fmt.minutes(s.minutes)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Ribbon words={['Foco', 'Memória', 'Ritmo', 'StudyOS', 'Evolução']} />

      <section className="wrap section">
        <div className="split">
          <div>
            <div className="section-head">
              <div>
                <h2 className="section-title">
                  Para <em>hoje</em>
                </h2>
                <p className="section-sub">Recomendações calculadas a partir das suas provas, tarefas, revisões e acertos.</p>
              </div>
            </div>
            {recs.length ? (
              <ul className="rec-list">
                {recs.slice(0, 6).map((r) => (
                  <li key={r.id} className={`rec ${r.tone}`}>
                    <span className="rec-icon" aria-hidden="true">
                      <Icon name={r.tone === 'urgent' ? 'alert' : r.tone === 'good' ? 'check' : 'target'} size={18} />
                    </span>
                    <div>
                      <p className="rec-title">
                        <span className="sr-only">{r.tone === 'urgent' ? 'Urgente: ' : r.tone === 'good' ? 'Concluído: ' : 'Foco: '}</span>
                        {r.title}
                      </p>
                      <p className="rec-detail">{r.detail}</p>
                    </div>
                    {r.action && (
                      <button type="button" className="btn btn-sm" onClick={() => navigate(r.action!.route, r.action!.params)}>
                        {r.action.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">
                <strong>Comece cadastrando suas matérias</strong>
                <span>As recomendações aparecem conforme você registra estudos, provas, quizzes e revisões.</span>
                <a className="btn btn-primary btn-sm" href={href('plano')}>
                  Abrir plano de estudos
                </a>
              </div>
            )}
          </div>
          <aside id="foco" className="panel focus-panel" aria-label="Cronômetro de foco">
            <FocusTimer />
            {due > 0 && (
              <a className="due-link" href={href('revisao')}>
                <Icon name="cards" size={16} /> {due} flashcards aguardando revisão <Icon name="arrow" size={16} />
              </a>
            )}
          </aside>
        </div>
      </section>

      <section className="ice-zone">
        <Wave />
        <span className="side-tag" aria-hidden="true">
          02
        </span>
        <div className="wrap section">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                Sua <em>evolução</em>
              </h2>
              <p className="section-sub">Somente dados registrados por você — nada simulado.</p>
            </div>
            <dl className="mini-stats">
              <div className="stat">
                <dt className="stat-label">7 dias</dt>
                <dd className="stat-value">{fmt.minutes(week)}</dd>
              </div>
              <div className="stat">
                <dt className="stat-label">Respostas</dt>
                <dd className="stat-value">{events.length}</dd>
              </div>
            </dl>
          </div>
          <div className="chart-grid-2">
            <div className="chart-card">
              {total14 > 0 ? (
                <BarChart
                  title="Minutos estudados · 14 dias"
                  data={days.map((d) => ({ label: fmt.dayMonth(d.key).slice(0, 5), sub: fmt.weekday(d.key), value: d.minutes }))}
                  format={(v) => fmt.minutes(v)}
                  goal={goal}
                  goalLabel={`Meta ${goal} min`}
                />
              ) : (
                <div className="empty">
                  <strong>Nenhuma sessão nos últimos 14 dias</strong>
                  <span>Use o cronômetro de foco ou registre sessões no plano para ver este gráfico.</span>
                </div>
              )}
            </div>
            <div className="chart-card">
              {weekly.some((w) => w.total > 0) ? (
                <LineChart title="Acerto semanal · quizzes e flashcards" data={weekly.map((w) => ({ label: w.label, value: w.accuracy, n: w.total }))} />
              ) : (
                <div className="empty">
                  <strong>Ainda sem respostas registradas</strong>
                  <span>Faça um quiz ou revise flashcards para acompanhar sua taxa de acerto semana a semana.</span>
                  <a className="btn btn-primary btn-sm" href={href('quiz')}>
                    Fazer um quiz
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
        <Wave bottom />
      </section>

      <section className="wrap section" style={{ position: 'relative' }}>
        <div className="section-head" style={{ marginTop: 40 }}>
          <div>
            <h2 className="section-title">
              Próximos <em>prazos</em>
            </h2>
            <p className="section-sub">Provas nas próximas 3 semanas e tarefas para os próximos 7 dias.</p>
          </div>
          <a className="btn btn-sm" href={href('plano')}>
            <Icon name="plus" size={14} /> Adicionar
          </a>
        </div>
        {upcoming.length ? (
          <ul className="rows timeline">
            {upcoming.slice(0, 8).map((u) => {
              const d = daysBetween(today, u.date);
              const s = data.subjects.find((x) => x.id === u.subjectId);
              return (
                <li key={u.id} className="row">
                  <span className={`date-badge${d <= 2 ? ' hot' : ''}`}>
                    <b>{fmt.dayMonth(u.date).slice(0, 2)}</b>
                    <small>{fmt.weekday(u.date)}</small>
                  </span>
                  <div>
                    <p className="row-title">{u.title}</p>
                    <p className="row-meta">
                      <span className="chip">{u.kind}</span>
                      <span>
                        <span className="subject-dot" style={{ background: subjectColor(s?.hue), display: 'inline-block', marginRight: 6 }} />
                        {subjectName(data.subjects, u.subjectId)}
                      </span>
                    </p>
                  </div>
                  <span className={`chip ${d <= 2 ? 'bad' : d <= 7 ? 'warn' : ''}`}>{fmt.relativeDays(d)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">
            <strong>Sem prazos próximos</strong>
            <span>Cadastre provas e tarefas com data para que apareçam aqui e influenciem as recomendações.</span>
          </div>
        )}
      </section>
    </div>
  );
}
