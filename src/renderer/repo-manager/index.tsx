import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';

import { ThemeProvider } from '@principal-ade/industry-theme';
import 'themed-markdown/dist/index.css';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { RepoManagerApp } from './RepoManagerApp';
import '../styles/tailwind.css';
import '../index.css';
import 'highlight.js/styles/atom-one-dark.css';

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});
// @ts-expect-error
window.mermaid = mermaid;

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (
    reason &&
    (reason.message === 'Canceled' ||
      reason.toString() === 'Canceled' ||
      reason.toString() === 'Canceled: Canceled' ||
      (reason.stack &&
        (reason.stack.includes('Delayer.cancel') ||
          reason.stack.includes('Delayer.dispose') ||
          reason.stack.includes('DisposableStore') ||
          reason.stack.includes('WordHighlighter') ||
          reason.stack.includes('monaco-editor'))))
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }

  console.error('[RepoManager] Unhandled promise rejection:', event.reason);
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

  console.error('[RepoManager] Global error:', event.error);
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <ThemeProvider>
    <AppErrorBoundary>
      <RepoManagerApp />
    </AppErrorBoundary>
  </ThemeProvider>,
);
