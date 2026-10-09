import { useState } from 'react';
import { getData } from '../lib/store';
import { verifyLock } from '../lib/crypto';
import { Orb } from '../components/Decor';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);

  return (
    <main className="lock-screen">
      <Orb size={180} />
      <h1>STUDY<span>OS</span></h1>
      <p>Perfil protegido por senha local.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const lock = getData().profile.lock;
          if (!lock || !password) return;
          setBusy(true);
          setError('');
          // Atraso progressivo após erros para dificultar tentativas repetidas.
          if (attempts >= 3) await new Promise((r) => setTimeout(r, Math.min(8000, 1000 * (attempts - 2))));
          const ok = await verifyLock(password, lock);
          setBusy(false);
          if (ok) onUnlock();
          else {
            setAttempts((a) => a + 1);
            setError('Senha incorreta.');
          }
        }}
      >
        <label className="field">
          <span>Senha</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy || !password}>
          {busy ? <span className="spinner" /> : 'Desbloquear'}
        </button>
      </form>
      <p className="lock-note">
        Esqueceu a senha? Os dados ficam apenas neste navegador; sem a senha, só é possível recomeçar limpando os dados do site nas
        configurações do navegador.
      </p>
    </main>
  );
}
