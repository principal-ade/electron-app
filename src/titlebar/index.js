import { jsx as _jsx } from 'react/jsx-runtime';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { CustomThemeProvider } from '../renderer/providers/CustomThemeProvider';
import '../renderer/index.css';
console.info('[Titlebar] Titlebar app starting...');
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}
const root = createRoot(container);
// Remote Agent Titlebar has been removed
root.render(
  _jsx(React.StrictMode, {
    children: _jsx(CustomThemeProvider, {
      children: _jsx('div', {}),
    }),
  }),
);
