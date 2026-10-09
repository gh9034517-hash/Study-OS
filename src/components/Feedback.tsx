import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Icon } from './Icon';

interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'error';
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast: (message: string, kind?: Toast['kind']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: Toast['kind'] = 'ok') => {
    const id = ++counter.current;
    setToasts((t) => [...t.slice(-3), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            <span className="toast-icon">
              <Icon name={t.kind === 'error' ? 'alert' : 'check'} size={14} />
            </span>
            <span>{t.message}</span>
            <button type="button" aria-label="Fechar aviso" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
      {pending && (
        <Modal title={pending.title} description={pending.message} onClose={() => close(false)}>
          <div className="form-actions">
            <button type="button" className="btn" onClick={() => close(false)} data-autofocus>
              Cancelar
            </button>
            <button type="button" className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {pending.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('FeedbackProvider ausente');
  return ctx;
}
