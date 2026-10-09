import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { HealthResponse } from '../../shared/api';
import { api } from '../lib/api';

export type AIState = 'checking' | 'online' | 'not_configured' | 'unreachable';

interface AIStatusValue {
  state: AIState;
  health?: HealthResponse;
  refresh: () => void;
}

const Ctx = createContext<AIStatusValue>({ state: 'checking', refresh: () => {} });

export function AIStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AIState>('checking');
  const [health, setHealth] = useState<HealthResponse>();

  const refresh = useCallback(() => {
    setState('checking');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    api
      .health(ctrl.signal)
      .then((h) => {
        setHealth(h);
        setState(h.aiConfigured ? 'online' : 'not_configured');
      })
      .catch(() => setState('unreachable'))
      .finally(() => clearTimeout(timer));
  }, []);

  useEffect(refresh, [refresh]);

  return <Ctx.Provider value={{ state, health, refresh }}>{children}</Ctx.Provider>;
}

export const useAIStatus = () => useContext(Ctx);

export const AI_STATE_TEXT: Record<AIState, string> = {
  checking: 'Verificando IA…',
  online: 'IA conectada',
  not_configured: 'IA não configurada',
  unreachable: 'Servidor offline',
};

export function AIStatusBanner({ feature }: { feature: string }) {
  const { state, refresh } = useAIStatus();
  if (state === 'online' || state === 'checking') return null;
  return (
    <div className="alert" role="status">
      <span aria-hidden="true">⚠</span>
      <div className="alert-body">
        <strong>{state === 'not_configured' ? 'A IA ainda não foi configurada no servidor.' : 'O servidor do StudyOS não respondeu.'}</strong>
        <span>
          {state === 'not_configured'
            ? `Para usar ${feature} com IA, defina GEMINI_API_KEY no backend (veja o README). Os recursos offline continuam funcionando.`
            : `${feature} com IA precisa do backend. Verifique se o servidor está rodando. Seus dados locais continuam disponíveis.`}
        </span>
        <div className="alert-actions">
          <button type="button" className="btn btn-sm" onClick={refresh}>
            Verificar novamente
          </button>
        </div>
      </div>
    </div>
  );
}
