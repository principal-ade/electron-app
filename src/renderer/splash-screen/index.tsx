// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('splash-screen');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { SplashScreenApp } from './SplashScreenApp';
import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import './splash-screen.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(
  <CustomThemeProvider>
    <SplashScreenApp />
  </CustomThemeProvider>,
);
