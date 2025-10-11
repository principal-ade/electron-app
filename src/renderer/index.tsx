import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';

import { ThemeProvider } from '@a24z/industry-theme';
import 'themed-markdown/dist/index.css';

import App from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import './styles/tailwind.css';
import './index.css';
import 'highlight.js/styles/atom-one-dark.css';

// Initialize mermaid and expose to window
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});
// @ts-expect-error
window.mermaid = mermaid;

// Global error handlers with Monaco error suppression
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  // Suppress Monaco cancellation errors
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

  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const error = event.error;
  // Suppress Monaco cancellation errors
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

  console.error('Global error:', event.error);
});

// Ensure DOM is ready
const container = document.getElementById('root');
if (!container) {
  console.error('Root element not found!');
  document.body.innerHTML =
    '<div style="height: 100%; color: red; padding: 20px;">Failed to initialize app: root element not found</div>';
} else {
  const root = createRoot(container);
  root.render(
    <ThemeProvider>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </ThemeProvider>,
  );
}
