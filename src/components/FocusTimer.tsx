import { useEffect, useRef, useState } from 'react';
import { useData } from '../lib/store';
import { elapsedMs, focusTimer, formatClock, useTick, useTimer } from '../lib/timer';
import { subjectName } from '../lib/analytics';
import { useFeedback } from './Feedback';
import { Icon } from './Icon';
import { href } from '../lib/router';

const PRESETS = [
  { min: 25, label: '25 min' },
  { min: 50, label: '50 min' },
  { min: 0, label: 'Livre' },
];

export function FocusTimer({ compact = false }: { compact?: boolean }) {
  const data = useData();
  const timer = useTimer();
  const { toast, confirm } = useFeedback();
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? '');
  const [preset, setPreset] = useState(25);
  useTick(Boolean(timer?.startedAt));
  const notified = useRef(false);

  useEffect(() => {
    if (!subjectId && data.subjects[0]) setSubjectId(data.subjects[0].id);
  }, [data.subjects, subjectId]);

  const ms = timer ? elapsedMs(timer) : 0;
  const targetMs = timer?.targetMin ? timer.targetMin * 60_000 : 0;
  const reached = Boolean(targetMs && ms >= targetMs);

  useEffect(() => {
    if (reached && !notified.current) {
      notified.current = true;
      toast('Tempo da sessão concluído! Encerre para registrar seus minutos.');
    }
    if (!timer) notified.current = false;
  }, [reached, timer, toast]);

  if (!data.subjects.length) {
    return (
      <div className="timer">
        <p className="timer-label">Sessão de foco</p>
        <p className="muted-text">
          Cadastre uma matéria no <a href={href('plano')}>Plano de estudos</a> para começar a cronometrar.
        </p>
      </div>
    );
  }

  if (!timer) {
    return (
      <form
        className={`timer${compact ? ' compact' : ''}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (!subjectId) return;
          focusTimer.start(subjectId, preset);
          toast('Sessão de foco iniciada.');
        }}
      >
        <p className="timer-label">Sessão de foco</p>
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
        <div className="preset-row" role="radiogroup" aria-label="Duração">
          {PRESETS.map((p) => (
            <button key={p.min} type="button" role="radio" aria-checked={preset === p.min} className="filter-btn" onClick={() => setPreset(p.min)}>
              {p.label}
            </button>
          ))}
        </div>
        <button type="submit" className="btn btn-primary">
          <Icon name="play" size={16} /> Iniciar foco
        </button>
      </form>
    );
  }

  const shown = targetMs ? (reached ? ms - targetMs : targetMs - ms) : ms;
  const progress = targetMs ? Math.min(1, ms / targetMs) : (ms % 3_600_000) / 3_600_000;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className={`timer running${compact ? ' compact' : ''}`}>
      <p className="timer-label">
        {timer.startedAt ? 'Em foco' : 'Pausado'} · {subjectName(data.subjects, timer.subjectId)}
      </p>
      <div className="timer-dial">
        <svg viewBox="0 0 128 128" aria-hidden="true">
          <circle cx="64" cy="64" r={R} className="dial-track" />
          <circle cx="64" cy="64" r={R} className="dial-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <div className="timer-clock" role="timer" aria-live="off">
          {reached ? '+' : ''}
          {formatClock(shown)}
          <small>{targetMs ? (reached ? 'além da meta' : 'restantes') : 'decorridos'}</small>
        </div>
      </div>
      <div className="timer-actions">
        {timer.startedAt ? (
          <button type="button" className="btn btn-sm" onClick={() => focusTimer.pause()}>
            <Icon name="pause" size={14} /> Pausar
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => focusTimer.resume()}>
            <Icon name="play" size={14} /> Retomar
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => {
            const min = focusTimer.finish();
            toast(min >= 1 ? `Sessão registrada: ${min} min.` : 'Sessão com menos de 1 minuto não foi registrada.');
          }}
        >
          <Icon name="check" size={14} /> Encerrar
        </button>
        <button
          type="button"
          className="btn btn-sm btn-icon"
          aria-label="Descartar sessão"
          onClick={async () => {
            if (await confirm({ title: 'Descartar sessão?', message: 'O tempo desta sessão não será registrado.', confirmLabel: 'Descartar', danger: true })) {
              focusTimer.discard();
            }
          }}
        >
          <Icon name="x" size={14} />
        </button>
      </div>
    </div>
  );
}

/** Indicador compacto no cabeçalho enquanto há uma sessão ativa. */
export function TimerPill() {
  const timer = useTimer();
  useTick(Boolean(timer?.startedAt));
  if (!timer) return null;
  return (
    <a className="timer-pill" href={href('plano')} aria-label="Sessão de foco em andamento">
      <span className={`status-dot ${timer.startedAt ? 'on' : 'off'}`} />
      {formatClock(elapsedMs(timer))}
    </a>
  );
}
