/**
 * Extension Window Entry Point
 *
 * This window allows users to browse and launch panel extensions.
 */

// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('extension');

import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '@principal-ade/industry-theme';

import { AppErrorBoundary } from '../AppErrorBoundary';
import { ExtensionWindowApp } from './ExtensionWindowApp';
import '../styles/tailwind.css';
import '../index.css';

// Handle unhandled rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('[ExtensionWindow] Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('[ExtensionWindow] Global error:', event.error);
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <ThemeProvider>
    <AppErrorBoundary>
      <ExtensionWindowApp />
    </AppErrorBoundary>
  </ThemeProvider>,
);
