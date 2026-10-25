import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { loadState } from './storage/store';
import { ProgressProvider } from './state/ProgressContext';
import { App } from './App';
import { Recovery } from './screens/Recovery';
import { ErrorBoundary } from './components/ErrorBoundary';

const loaded = loadState();
const root = createRoot(document.getElementById('root')!);

root.render(
  <StrictMode>
    <ErrorBoundary>
      {loaded.ok ? (
        <ProgressProvider initial={loaded.state}>
          <App />
        </ProgressProvider>
      ) : (
        <Recovery raw={loaded.raw} problems={loaded.problems} />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
