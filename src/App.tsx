import { lazy, Suspense, useEffect, useState } from 'react';
import { recoveredFromBackup, useData, useSaveState } from './lib/store';
import { href, ROUTES, useRoute, type RouteName } from './lib/router';
import { Icon, type IconName } from './components/Icon';
import { AI_STATE_TEXT, useAIStatus } from './components/AIStatus';
import { TimerPill } from './components/FocusTimer';
import { useFeedback } from './components/Feedback';
import { Onboarding } from './pages/Onboarding';
import { LockScreen } from './pages/LockScreen';
import { fmt } from './lib/date';
import Dashboard from './pages/Dashboard';

const Tutor = lazy(() => import('./pages/Tutor'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Planner = lazy(() => import('./pages/Planner'));
const Review = lazy(() => import('./pages/Review'));
const Diagnosis = lazy(() => import('./pages/Diagnosis'));
const Settings = lazy(() => import('./pages/Settings'));

const ICONS: Record<RouteName, IconName> = {
  painel: 'home',
  tutor: 'spark',
  quiz: 'quiz',
  plano: 'calendar',
  revisao: 'cards',
  diagnostico: 'pulse',
  ajustes: 'settings',
};

const TITLES: Record<RouteName, string> = {
  painel: 'Painel',
  tutor: 'Tutor de IA',
  quiz: 'Quiz inteligente',
  plano: 'Plano de estudos',
  revisao: 'Revisão inteligente',
  diagnostico: 'Diagnóstico de aprendizagem',
  ajustes: 'Ajustes',
};

export default function App() {
  const data = useData();
  const { route } = useRoute();
  const [unlocked, setUnlocked] = useState(!data.profile.lock);
  const { toast } = useFeedback();

  useEffect(() => {
    document.title = `${TITLES[route]} · StudyOS`;
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [route]);

  useEffect(() => {
    if (recoveredFromBackup) toast('Os dados principais estavam corrompidos e foram recuperados da cópia de segurança.', 'error');
  }, [toast]);

  if (data.profile.lock && !unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;

  return (
    <>
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <TopBar route={route} />
      <main id="main" tabIndex={-1} style={{ outline: 'none' }}>
        <Suspense fallback={<PageFallback />}>
          {route === 'painel' && <Dashboard />}
          {route === 'tutor' && <Tutor />}
          {route === 'quiz' && <Quiz />}
          {route === 'plano' && <Planner />}
          {route === 'revisao' && <Review />}
          {route === 'diagnostico' && <Diagnosis />}
          {route === 'ajustes' && <Settings />}
        </Suspense>
      </main>
      <Footer />
      <BottomNav route={route} />
      {!data.profile.onboarded && <Onboarding />}
    </>
  );
}

function PageFallback() {
  return (
    <div className="wrap" aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ height: 40, width: 220, marginTop: 48 }} />
      <div className="skeleton" style={{ height: 80, width: '70%', marginTop: 20 }} />
      <div className="skeleton" style={{ height: 240, marginTop: 32 }} />
    </div>
  );
}

function TopBar({ route }: { route: RouteName }) {
  const ai = useAIStatus();
  const save = useSaveState();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href={href('painel')} aria-label="StudyOS, ir para o painel">
          <span className="brand-mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
              <path d="M7 8h10M7 12h10M7 16h6" />
            </svg>
          </span>
          <span>
            STUDY<b>OS</b>
          </span>
        </a>
        <nav className="pillnav" aria-label="Principal">
          {ROUTES.map((r) => (
            <a key={r.name} href={href(r.name)} aria-current={route === r.name ? 'page' : undefined}>
              {r.label}
            </a>
          ))}
        </nav>
        <div className="topbar-actions">
          <TimerPill />
          <span className="status-chip" title={ai.health ? `${ai.health.provider} · ${ai.health.model}` : undefined}>
            <span className={`status-dot ${ai.state === 'online' ? 'on' : ai.state === 'checking' ? '' : ai.state === 'unreachable' ? 'err' : 'off'}`} />
            <span className="label-long">{AI_STATE_TEXT[ai.state]}</span>
            <span className="sr-only">{AI_STATE_TEXT[ai.state]}</span>
          </span>
          <span className="save-indicator" aria-live="polite">
            {save.status === 'saving' && 'Salvando…'}
            {save.status === 'saved' && save.at && `Salvo ${fmt.time(save.at)}`}
            {save.status === 'error' && <span className="save-error">Erro ao salvar</span>}
          </span>
          <a className="icon-btn" href={href('ajustes')} aria-label="Ajustes" aria-current={route === 'ajustes' ? 'page' : undefined}>
            <Icon name="settings" />
          </a>
        </div>
      </div>
      {save.status === 'error' && (
        <div className="wrap" style={{ marginTop: 10 }}>
          <div className="alert error" role="alert">
            <span aria-hidden="true">⚠</span>
            <div className="alert-body">{save.message}</div>
          </div>
        </div>
      )}
    </header>
  );
}

function BottomNav({ route }: { route: RouteName }) {
  return (
    <nav className="bottomnav" aria-label="Principal (móvel)">
      {ROUTES.map((r) => (
        <a key={r.name} href={href(r.name)} aria-current={route === r.name ? 'page' : undefined}>
          <Icon name={ICONS[r.name]} size={20} />
          {r.short}
        </a>
      ))}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <span className="ghost-word" aria-hidden="true">
        STUDYOS
      </span>
      <div className="wrap footer-grid">
        <div>
          <h4>StudyOS</h4>
          <p>
            Plataforma de estudos com IA. Seus dados ficam salvos neste navegador; somente as mensagens enviadas ao tutor, quiz e
            diagnóstico com IA passam pelo servidor até o provedor de IA.
          </p>
        </div>
        <div>
          <h4>Módulos</h4>
          <ul>
            {ROUTES.map((r) => (
              <li key={r.name}>
                <a href={href(r.name)}>{r.label}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>IA gratuita</h4>
          <p>
            A camada gratuita do provedor tem limites de requisições por minuto e por dia. Quando esgotar, o quiz e a revisão seguem
            funcionando no modo offline.
          </p>
        </div>
      </div>
    </footer>
  );
}
