// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('goodbye-screen');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoodbyeScreenApp } from './GoodbyeScreenApp';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import './goodbye-screen.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <CustomThemeProvider>
    <GoodbyeScreenApp />
  </CustomThemeProvider>,
);
