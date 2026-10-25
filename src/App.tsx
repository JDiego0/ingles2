import { useEffect, useRef } from 'react';
import { useRoute } from './router';
import { useProgress } from './state/ProgressContext';
import { useOnline, useServiceWorker } from './pwa';
import { dueChunks } from './engine/srs';
import { Icon, type IconName } from './components/Icon';
import { Dashboard } from './screens/Dashboard';
import { PathScreen } from './screens/Path';
import { LessonPlayer } from './screens/LessonPlayer';
import { ReviewScreen } from './screens/Review';
import { LibraryScreen } from './screens/Library';
import { ChunkDetail } from './screens/ChunkDetail';
import { ConversationList, ConversationPlayer } from './screens/Conversation';
import { PronunciationScreen } from './screens/Pronunciation';
import { ProgressScreen } from './screens/Progress';
import { DiagnosticScreen } from './screens/Diagnostic';
import { AssessmentScreen } from './screens/Assessment';
import { SettingsScreen } from './screens/Settings';
import { PracticeHub } from './screens/Practice';
import { Welcome } from './screens/Welcome';

/** Pantallas de estudio activo: cuentan tiempo de práctica y ocultan la navegación inferior. */
const FOCUS = new Set(['leccion', 'evaluacion', 'diagnostico']);
const STUDY = new Set(['leccion', 'evaluacion', 'diagnostico', 'repaso', 'conversar', 'pronunciacion', 'biblioteca']);

function useTheme(theme: 'system' | 'light' | 'dark') {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

/** Suma tiempo de estudio mientras la app está visible y hubo interacción en los últimos 90 s. */
function useStudyTimer(active: boolean) {
  const { act } = useProgress();
  const last = useRef(Date.now());
  useEffect(() => {
    const mark = () => (last.current = Date.now());
    window.addEventListener('pointerdown', mark);
    window.addEventListener('keydown', mark);
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const TICK = 15;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - last.current < 90_000) act.addStudySeconds(TICK);
    }, TICK * 1000);
    return () => clearInterval(id);
  }, [active, act]);
}

const NAV: { href: string; label: string; icon: IconName; match: string[] }[] = [
  { href: '#/', label: 'Inicio', icon: 'home', match: [''] },
  { href: '#/ruta', label: 'Ruta', icon: 'map', match: ['ruta'] },
  { href: '#/repaso', label: 'Repasar', icon: 'repeat', match: ['repaso'] },
  { href: '#/practicar', label: 'Practicar', icon: 'chat', match: ['practicar', 'conversar', 'pronunciacion', 'biblioteca'] },
  { href: '#/progreso', label: 'Progreso', icon: 'chart', match: ['progreso'] },
];

export function App() {
  const { state, saveFailed } = useProgress();
  const route = useRoute();
  const sw = useServiceWorker();
  const online = useOnline();
  const [section = '', a, b] = route.parts;
  useTheme(state.settings.theme);
  useStudyTimer(STUDY.has(section));
  const due = dueChunks(state.chunks, Date.now()).length;
  const focus = FOCUS.has(section) || (section === 'conversar' && !!a);

  let screen: React.ReactNode;
  if (!state.onboarded && section !== 'diagnostico' && section !== 'ajustes') screen = <Welcome />;
  else
    switch (section) {
      case '':
        screen = <Dashboard />;
        break;
      case 'ruta':
        screen = <PathScreen />;
        break;
      case 'leccion':
        screen = <LessonPlayer key={a} lessonId={a} />;
        break;
      case 'repaso':
        screen = <ReviewScreen />;
        break;
      case 'biblioteca':
        screen = a ? <ChunkDetail key={a} id={a} /> : <LibraryScreen />;
        break;
      case 'conversar':
        screen = a ? <ConversationPlayer key={a} id={a} /> : <ConversationList />;
        break;
      case 'pronunciacion':
        screen = <PronunciationScreen />;
        break;
      case 'progreso':
        screen = <ProgressScreen />;
        break;
      case 'diagnostico':
        screen = <DiagnosticScreen />;
        break;
      case 'evaluacion':
        screen = <AssessmentScreen key={`${a}/${b}`} kind={a} id={b} />;
        break;
      case 'ajustes':
        screen = <SettingsScreen />;
        break;
      case 'practicar':
        screen = <PracticeHub />;
        break;
      default:
        screen = (
          <div className="card">
            <h1>Página no encontrada</h1>
            <a className="btn btn--primary" href="#/">Ir al inicio</a>
          </div>
        );
    }

  return (
    <div className={`app ${focus ? 'app--focus' : ''}`}>
      <a className="skip-link" href="#main">Saltar al contenido</a>
      {!focus && state.onboarded && (
        <header className="topbar">
          <a href="#/" className="brand" aria-label="English Journey, inicio">
            <img src="./icons/icon.svg" alt="" width={28} height={28} />
            <span>English Journey</span>
          </a>
          <div className="topbar__right">
            {!online && <span className="chip chip--muted">Sin conexión</span>}
            <a className="icon-btn" href="#/ajustes" aria-label="Ajustes">
              <Icon name="settings" />
            </a>
          </div>
        </header>
      )}
      {sw.updateAvailable && (
        <div className="banner" role="status">
          <span>Hay una versión nueva de la app.</span>
          <button className="btn btn--sm btn--primary" onClick={sw.applyUpdate}>
            Actualizar
          </button>
        </div>
      )}
      {saveFailed && (
        <div className="banner banner--warn" role="alert">
          No se pudo guardar el progreso en este navegador (almacenamiento lleno o bloqueado). Exporta una copia en Ajustes.
        </div>
      )}
      <main id="main" className="app-main" tabIndex={-1}>
        {screen}
      </main>
      {!focus && state.onboarded && (
        <nav className="bottom-nav" aria-label="Navegación principal">
          {NAV.map((n) => {
            const active = n.match.includes(section);
            return (
              <a key={n.href} href={n.href} className={`bottom-nav__item ${active ? 'is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                <span className="bottom-nav__icon">
                  <Icon name={n.icon} size={22} />
                  {n.icon === 'repeat' && due > 0 && <span className="badge" aria-label={`${due} pendientes`}>{due > 99 ? '99+' : due}</span>}
                </span>
                <span>{n.label}</span>
              </a>
            );
          })}
        </nav>
      )}
    </div>
  );
}
