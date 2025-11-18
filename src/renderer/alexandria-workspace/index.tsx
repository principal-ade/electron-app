import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@principal-ade/industry-theme';
import '../styles/tailwind.css';
import '../index.css';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { AlexandriaWorkspaceApp } from './AlexandriaWorkspaceApp';

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason &&
    (reason.message === 'Canceled' ||
      reason.toString() === 'Canceled' ||
      reason.toString() === 'Canceled: Canceled')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  console.error('[AlexandriaWorkspace] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const error = event.error;
  if (
    error &&
    (error.message === 'Canceled' ||
      error.toString() === 'Canceled' ||
      error.toString() === 'Canceled: Canceled')
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  console.error('[AlexandriaWorkspace] Global error:', event.error);
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <ThemeProvider>
    <AppErrorBoundary>
      <AlexandriaWorkspaceApp />
    </AppErrorBoundary>
  </ThemeProvider>,
);
