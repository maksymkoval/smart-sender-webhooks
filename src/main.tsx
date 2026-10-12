import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles.css';

async function startMockApi(): Promise<void> {
  // There is no real backend: the mock is part of the app in every mode.
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass', quiet: import.meta.env.PROD });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root is missing');

void startMockApi().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
