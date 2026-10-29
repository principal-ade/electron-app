/**
 * Detached Tab Window Entry Point
 *
 * A minimal host for a single workspace tab moved out of the principal window.
 * It shares the main preload (theme, topics, subsystem models) but has no
 * navigation sidebar, no terminal, and no multi-tab bucket.
 */

// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('detached-tab');

import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';
import 'themed-markdown/dist/index.css';
import '../styles/tailwind.css';
import '../index.css';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { DetachedTabWindow } from './DetachedTabWindow';

// Topic descriptions can contain mermaid blocks; themed-markdown reads the
// global instance (same setup as the principal window).
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});
// @ts-expect-error - mermaid is not a standard window property
window.mermaid = mermaid;

window.addEventListener('unhandledrejection', (event) => {
  console.error('[DetachedTab] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('[DetachedTab] Global error:', event.error);
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

createRoot(container).render(
  <AppErrorBoundary>
    <CustomThemeProvider>
      <DetachedTabWindow />
    </CustomThemeProvider>
  </AppErrorBoundary>,
);
