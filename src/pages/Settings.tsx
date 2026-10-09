import { useRef, useState } from 'react';
import { emptyData, getData, normalizeData, replaceData, setData, useData } from '../lib/store';
import { createLock, verifyLock } from '../lib/crypto';
import { toDateKey } from '../lib/date';
import type { Level } from '../lib/types';
import { PageHero } from '../components/Decor';
import { Icon } from '../components/Icon';
import { AI_STATE_TEXT, useAIStatus } from '../components/AIStatus';
import { useFeedback } from '../components/Feedback';

export default function Settings() {
  return (
    <div className="page settings-page">
      <div className="wrap">
        <PageHero
          num="07"
          label="Ajustes"
          ghost="AJUSTES"
          title={
            <>
              Do seu <em>jeito.</em>
            </>
          }
          lead="Perfil, segurança local, backup dos dados e status da IA."
        />
        <div className="settings-grid">
          <ProfileForm />
          <AIInfo />
          <LockSettings />
          <DataSettings />
        </div>
      </div>
    </div>
  );
}

function ProfileForm() {
  const data = useData();
  const { toast } = useFeedback();
  const [name, setName] = useState(data.profile.name);
  const [level, setLevel] = useState<Level>(data.profile.level);
  const [goal, setGoal] = useState(data.profile.dailyGoalMinutes);
  return (
    <section className="panel">
      <h2 className="settings-title">Perfil</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setData((d) => ({ ...d, profile: { ...d.profile, name: name.trim().slice(0, 60), level, dailyGoalMinutes: goal } }));
          toast('Perfil atualizado.');
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <div className="form-grid" style={{ marginTop: 14 }}>
          <label className="field">
            <span>Nível padrão</span>
            <select className="select" value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              <option value="iniciante">Iniciante</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </select>
          </label>
          <label className="field">
            <span>Meta diária (min)</span>
            <input className="input" type="number" min={10} max={600} step={5} value={goal} onChange={(e) => setGoal(Math.min(600, Math.max(10, Number(e.target.value) || 10)))} />
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Salvar perfil
          </button>
        </div>
      </form>
    </section>
  );
}

function AIInfo() {
  const { state, health, refresh } = useAIStatus();
  return (
    <section className="panel">
      <h2 className="settings-title">Inteligência artificial</h2>
      <p className="ai-state">
        <span className={`status-dot ${state === 'online' ? 'on' : state === 'checking' ? '' : state === 'unreachable' ? 'err' : 'off'}`} />
        {AI_STATE_TEXT[state]}
      </p>
      {health && (
        <dl className="kv">
          <dt>Provedor</dt>
          <dd>{health.provider === 'gemini' ? 'Google Gemini (camada gratuita)' : 'Groq (camada gratuita)'}</dd>
          <dt>Modelo</dt>
          <dd>{health.model}</dd>
          <dt>Limite deste servidor</dt>
          <dd>
            {health.limits.perMinute}/min · {health.limits.perDay}/dia por acesso
          </dd>
        </dl>
      )}
      <div className="alert info" style={{ marginTop: 14 }}>
        <span aria-hidden="true">ℹ</span>
        <div className="alert-body">
          <strong>Limites da IA gratuita</strong>
          <span>
            A camada gratuita do provedor tem cotas por minuto e por dia que podem mudar sem aviso. Ao atingir o limite, a IA fica
            indisponível temporariamente; o quiz offline, os flashcards e o plano continuam funcionando. Pela política do provedor, dados
            enviados na camada gratuita podem ser usados para melhorar os serviços dele — não envie informações pessoais ao tutor.
          </span>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-sm" onClick={refresh}>
          <Icon name="refresh" size={14} /> Verificar conexão
        </button>
      </div>
    </section>
  );
}

function LockSettings() {
  const data = useData();
  const { toast } = useFeedback();
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasLock = Boolean(data.profile.lock);

  const submit = async (remove = false) => {
    setError('');
    if (hasLock && !(await verifyLock(current, data.profile.lock!))) return setError('Senha atual incorreta.');
    if (remove) {
      setData((d) => ({ ...d, profile: { ...d.profile, lock: undefined } }));
      toast('Senha removida.');
    } else {
      if (pw.length < 6) return setError('A nova senha precisa ter pelo menos 6 caracteres.');
      if (pw !== pw2) return setError('As senhas não conferem.');
      setBusy(true);
      const lock = await createLock(pw);
      setBusy(false);
      setData((d) => ({ ...d, profile: { ...d.profile, lock } }));
      toast(hasLock ? 'Senha alterada.' : 'Senha definida.');
    }
    setCurrent('');
    setPw('');
    setPw2('');
  };

  return (
    <section className="panel">
      <h2 className="settings-title">Senha local</h2>
      <p className="muted-text" style={{ marginBottom: 14 }}>
        Pede uma senha ao abrir o StudyOS neste navegador. A senha é guardada apenas como hash PBKDF2 com sal — nunca em texto puro. Ela
        impede acesso casual, mas não criptografa os dados salvos no navegador.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {hasLock && (
          <label className="field">
            <span>Senha atual</span>
            <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </label>
        )}
        <div className="form-grid" style={{ marginTop: hasLock ? 14 : 0 }}>
          <label className="field">
            <span>{hasLock ? 'Nova senha' : 'Senha'}</span>
            <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} />
          </label>
          <label className="field">
            <span>Confirmar</span>
            <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert" style={{ marginTop: 10 }}>
            {error}
          </p>
        )}
        <div className="form-actions">
          {hasLock && (
            <button type="button" className="btn btn-danger" onClick={() => submit(true)} disabled={!current}>
              Remover senha
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !pw}>
            <Icon name="lock" size={14} /> {hasLock ? 'Alterar senha' : 'Definir senha'}
          </button>
        </div>
      </form>
    </section>
  );
}

function DataSettings() {
  const data = useData();
  const { toast, confirm } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);
  const size = new Blob([JSON.stringify(data)]).size;

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getData(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studyos-backup-${toDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exportado.');
  };

  const importData = async (file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo grande demais (máx. 10 MB).');
      const parsed = normalizeData(JSON.parse(await file.text()));
      const ok = await confirm({
        title: 'Substituir os dados atuais?',
        message: `O backup contém ${parsed.subjects.length} matérias, ${parsed.tasks.length} tarefas, ${parsed.attempts.length} quizzes e ${parsed.cards.length} flashcards. Os dados atuais deste navegador serão substituídos.`,
        confirmLabel: 'Importar',
        danger: true,
      });
      if (!ok) return;
      replaceData({ ...parsed, profile: { ...parsed.profile, onboarded: true } });
      toast('Backup importado com sucesso.');
    } catch (err) {
      toast(err instanceof SyntaxError ? 'O arquivo não é um JSON válido.' : (err as Error).message || 'Falha ao importar.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="panel">
      <h2 className="settings-title">Seus dados</h2>
      <p className="muted-text" style={{ marginBottom: 14 }}>
        Tudo é salvo automaticamente neste navegador (≈ {(size / 1024).toFixed(1)} KB). Exporte um backup para levar a outro dispositivo ou
        se proteger contra limpeza do navegador.
      </p>
      <div className="data-actions">
        <button type="button" className="btn btn-primary" onClick={exportData}>
          <Icon name="download" size={16} /> Exportar backup
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={16} /> Importar backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (await confirm({ title: 'Apagar todos os dados?', message: 'Matérias, tarefas, histórico, flashcards e conversas serão removidos deste navegador. Esta ação não pode ser desfeita.', confirmLabel: 'Apagar tudo', danger: true })) {
              replaceData(emptyData());
              toast('Todos os dados foram apagados.');
            }
          }}
        >
          <Icon name="trash" size={16} /> Apagar tudo
        </button>
      </div>
    </section>
  );
}
