import { useSyncExternalStore } from 'react';
import type { AppData, Profile } from './types';
import { DEFAULT_APPEARANCE, normalizeAppearance } from './appearance';

const STORAGE_KEY = 'studyos:data:v1';
const BACKUP_KEY = 'studyos:data:v1:backup';

export const defaultProfile: Profile = {
  name: '',
  level: 'intermediario',
  dailyGoalMinutes: 60,
  onboarded: false,
};

export function emptyData(): AppData {
  return {
    version: 1,
    profile: { ...defaultProfile },
    subjects: [],
    tasks: [],
    exams: [],
    sessions: [],
    attempts: [],
    cards: [],
    reviews: [],
    chats: [],
    appearance: { ...DEFAULT_APPEARANCE },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const arr = <T>(v: unknown, keep: (x: Record<string, unknown>) => boolean): T[] =>
  Array.isArray(v) ? (v.filter((x) => isObj(x) && keep(x)) as T[]) : [];
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Normaliza dados vindos do armazenamento ou de um backup importado, descartando registros corrompidos. */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) throw new Error('Arquivo sem dados do StudyOS.');
  const base = emptyData();
  const p = isObj(raw.profile) ? raw.profile : {};
  const level = ['iniciante', 'intermediario', 'avancado'].includes(p.level as string) ? (p.level as Profile['level']) : base.profile.level;
  const lock = isObj(p.lock) && str(p.lock.salt) && str(p.lock.hash) && num(p.lock.iterations) ? (p.lock as unknown as Profile['lock']) : undefined;
  return {
    version: 1,
    profile: {
      name: typeof p.name === 'string' ? p.name.slice(0, 60) : '',
      level,
      dailyGoalMinutes: num(p.dailyGoalMinutes) ? Math.min(600, Math.max(10, p.dailyGoalMinutes as number)) : 60,
      onboarded: Boolean(p.onboarded),
      lock,
    },
    subjects: arr(raw.subjects, (x) => str(x.id) && str(x.name)),
    tasks: arr(raw.tasks, (x) => str(x.id) && str(x.title) && str(x.subjectId)),
    exams: arr(raw.exams, (x) => str(x.id) && str(x.date) && str(x.subjectId)),
    sessions: arr(raw.sessions, (x) => str(x.id) && str(x.date) && num(x.minutes)),
    attempts: arr(raw.attempts, (x) => str(x.id) && str(x.date) && Array.isArray(x.questions)),
    cards: arr(raw.cards, (x) => str(x.id) && str(x.front) && str(x.back) && str(x.due)),
    reviews: arr(raw.reviews, (x) => str(x.id) && str(x.cardId) && num(x.grade)),
    chats: arr(raw.chats, (x) => str(x.id) && Array.isArray(x.messages)),
    insights: isObj(raw.insights) && str(raw.insights.text) ? (raw.insights as AppData['insights']) : undefined,
    appearance: normalizeAppearance(raw.appearance),
  };
}

function load(): { data: AppData; recovered: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { data: normalizeData(JSON.parse(raw)), recovered: false };
  } catch {
    // Dados principais corrompidos: tenta a cópia de segurança.
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) return { data: normalizeData(JSON.parse(backup)), recovered: true };
    } catch {
      /* ignora */
    }
  }
  return { data: emptyData(), recovered: false };
}

export type SaveState = { status: 'idle' | 'saving' | 'saved' | 'error'; at?: string; message?: string };

const initial = load();
let state: AppData = initial.data;
let saveState: SaveState = { status: 'idle' };
export const recoveredFromBackup = initial.recovered;
const listeners = new Set<() => void>();
const saveListeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastBackup = 0;

function emit() {
  listeners.forEach((l) => l());
}
function setSaveState(next: SaveState) {
  saveState = next;
  saveListeners.forEach((l) => l());
}

function persist() {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    // Cópia de segurança a cada 5 minutos, usada se os dados principais corromperem.
    if (Date.now() - lastBackup > 5 * 60_000) {
      localStorage.setItem(BACKUP_KEY, json);
      lastBackup = Date.now();
    }
    setSaveState({ status: 'saved', at: new Date().toISOString() });
  } catch (err) {
    const quota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
    setSaveState({
      status: 'error',
      message: quota
        ? 'Armazenamento do navegador cheio. Exporte um backup e apague conversas antigas.'
        : 'Não foi possível salvar no navegador (modo privado ou armazenamento bloqueado).',
    });
  }
}

export function setData(updater: (d: AppData) => AppData) {
  state = updater(state);
  emit();
  setSaveState({ status: 'saving' });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 350);
}

export function replaceData(next: AppData) {
  setData(() => next);
}

export function getData(): AppData {
  return state;
}

export function useData(): AppData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function useSaveState(): SaveState {
  return useSyncExternalStore(
    (l) => {
      saveListeners.add(l);
      return () => saveListeners.delete(l);
    },
    () => saveState,
  );
}

// Garante gravação ao fechar a aba.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveState.status === 'saving') persist();
  });
  // Sincroniza entre abas abertas.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = normalizeData(JSON.parse(e.newValue));
        emit();
      } catch {
        /* ignora */
      }
    }
  });
}

/** Rascunhos pequenos (ex.: mensagem do tutor) salvos separadamente. */
export const drafts = {
  get(key: string): string {
    try {
      return localStorage.getItem(`studyos:draft:${key}`) ?? '';
    } catch {
      return '';
    }
  },
  set(key: string, value: string) {
    try {
      if (value) localStorage.setItem(`studyos:draft:${key}`, value);
      else localStorage.removeItem(`studyos:draft:${key}`);
    } catch {
      /* ignora */
    }
  },
};
