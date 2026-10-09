import { useSyncExternalStore } from 'react';

export type RouteName = 'painel' | 'tutor' | 'quiz' | 'plano' | 'revisao' | 'diagnostico' | 'ajustes';

export const ROUTES: { name: RouteName; label: string; short: string }[] = [
  { name: 'painel', label: 'Painel', short: 'Painel' },
  { name: 'tutor', label: 'Tutor IA', short: 'Tutor' },
  { name: 'quiz', label: 'Quiz', short: 'Quiz' },
  { name: 'plano', label: 'Plano', short: 'Plano' },
  { name: 'revisao', label: 'Revisão', short: 'Revisão' },
  { name: 'diagnostico', label: 'Diagnóstico', short: 'Diagnóst.' },
];

function parse(): { route: RouteName; params: URLSearchParams } {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  const name = path.split('/')[0] as RouteName;
  const valid: RouteName[] = ['painel', 'tutor', 'quiz', 'plano', 'revisao', 'diagnostico', 'ajustes'];
  return { route: valid.includes(name) ? name : 'painel', params: new URLSearchParams(query) };
}

let current = parse();
const listeners = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse();
  listeners.forEach((l) => l());
});

export function useRoute() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function navigate(route: RouteName, params?: Record<string, string>) {
  const q = params ? `?${new URLSearchParams(params).toString()}` : '';
  window.location.hash = `/${route}${q}`;
}

export const href = (route: RouteName, params?: Record<string, string>) =>
  `#/${route}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;
