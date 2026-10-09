import { useEffect, useState, useSyncExternalStore } from 'react';
import { setData } from './store';
import { uid } from './id';
import { toDateKey } from './date';

// Cronômetro de foco persistente: sobrevive a navegação e recarregamento da página.
export interface TimerState {
  subjectId: string;
  targetMin: number; // 0 = livre
  startedAt: number | null; // epoch ms quando rodando
  accumulatedMs: number;
}

const KEY = 'studyos:timer';
let timer: TimerState | null = read();
const listeners = new Set<() => void>();

function read(): TimerState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TimerState) : null;
  } catch {
    return null;
  }
}
function write(next: TimerState | null) {
  timer = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
  listeners.forEach((l) => l());
}

export function elapsedMs(t: TimerState, now = Date.now()) {
  return t.accumulatedMs + (t.startedAt ? now - t.startedAt : 0);
}

export const focusTimer = {
  start(subjectId: string, targetMin: number) {
    write({ subjectId, targetMin, startedAt: Date.now(), accumulatedMs: 0 });
  },
  pause() {
    if (timer?.startedAt) write({ ...timer, accumulatedMs: elapsedMs(timer), startedAt: null });
  },
  resume() {
    if (timer && !timer.startedAt) write({ ...timer, startedAt: Date.now() });
  },
  /** Encerra e registra a sessão (se tiver ao menos 1 minuto). Retorna os minutos registrados. */
  finish(): number {
    if (!timer) return 0;
    const minutes = Math.round(elapsedMs(timer) / 60_000);
    const t = timer;
    write(null);
    if (minutes >= 1) {
      setData((d) => ({
        ...d,
        sessions: [
          ...d.sessions,
          {
            id: uid(),
            subjectId: t.subjectId,
            date: toDateKey(),
            minutes,
            status: 'concluida',
            source: 'timer',
            completedAt: new Date().toISOString(),
          },
        ],
      }));
    }
    return minutes;
  },
  discard() {
    write(null);
  },
};

export function useTimer(): TimerState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => timer,
  );
}

/** Re-renderiza a cada segundo enquanto o cronômetro roda. */
export function useTick(active: boolean) {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setN((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
