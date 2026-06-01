// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('alexandria');

import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';
import '../styles/tailwind.css';
import '../index.css';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { AlexandriaWorkspaceApp } from './AlexandriaWorkspaceApp';

// Initialize mermaid and expose to window so themed-markdown's
// IndustryMermaidDiagram (which reads window.mermaid) can render diagrams.
// Without this, topic/markdown mermaid blocks flash a placeholder and never paint.
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});
// @ts-expect-error - mermaid is not a standard window property
window.mermaid = mermaid;

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

  console.error(
    '[AlexandriaWorkspace] Unhandled promise rejection:',
    event.reason,
  );
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
  <AppErrorBoundary>
    <AlexandriaWorkspaceApp />
  </AppErrorBoundary>,
);
