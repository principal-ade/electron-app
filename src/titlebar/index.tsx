import React from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteAgentTitlebar } from './RemoteAgentTitlebar';
import { CustomThemeProvider } from '../renderer/providers/CustomThemeProvider';
import '../renderer/index.css';

console.info('[Titlebar] Titlebar app starting...');

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <CustomThemeProvider>
      <RemoteAgentTitlebar />
    </CustomThemeProvider>
  </React.StrictMode>,
);
