const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((fromDateKey(toKey).getTime() - fromDateKey(fromKey).getTime()) / 86_400_000);
}

export function lastNDays(n: number, end = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => toDateKey(addDays(end, i - n + 1)));
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const full = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const fmt = {
  weekday: (key: string) => weekday.format(fromDateKey(key)).replace('.', ''),
  dayMonth: (key: string) => dayMonth.format(fromDateKey(key)),
  full: (keyOrIso: string) => full.format(keyOrIso.length === 10 ? fromDateKey(keyOrIso) : new Date(keyOrIso)),
  time: (iso: string) => time.format(new Date(iso)),
  minutes: (min: number) => {
    const m = Math.round(min);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${pad(r)}min` : `${h}h`;
  },
  relativeDays: (days: number) =>
    days === 0 ? 'hoje' : days === 1 ? 'amanhã' : days === -1 ? 'ontem' : days > 0 ? `em ${days} dias` : `há ${-days} dias`,
};

/** Segunda-feira da semana da data (chave YYYY-MM-DD). */
export function weekStartKey(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = (copy.getDay() + 6) % 7;
  return toDateKey(addDays(copy, -diff));
}
