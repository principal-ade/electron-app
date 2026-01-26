/**
 * Dev Workspace Window Entry Point
 *
 * This is a minimal window that uses only the APIs exposed by preload-dev-workspace.ts:
 * - terminal
 * - fileSystem
 * - repositoryMonitoring
 * - userPreferences
 */

import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';

import 'themed-markdown/dist/index.css';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { DevWorkspaceApp } from './DevWorkspaceApp';
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

// Handle unhandled rejections (common with Monaco editor cancellations)
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

  console.error('[DevWorkspace] Unhandled promise rejection:', event.reason);
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

  // Log detailed error information even when event.error is null
  console.error('[DevWorkspace] Global error:', {
    error: event.error,
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    type: event.type,
  });
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <CustomThemeProvider>
    <AppErrorBoundary>
      <DevWorkspaceApp />
    </AppErrorBoundary>
  </CustomThemeProvider>,
);
