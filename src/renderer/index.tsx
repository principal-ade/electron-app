import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';

import { ThemeProvider } from 'themed-markdown';

import App from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import './styles/tailwind.css';
import './index.css';

// Initialize mermaid and expose to window
mermaid.initialize({ 
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose'
});
// @ts-expect-error
window.mermaid = mermaid;

// Global error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Prevent the default handling (which would log to console)
  event.preventDefault();
});

window.addEventListener('error', (event) => {
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
    </ThemeProvider>
  );
}
