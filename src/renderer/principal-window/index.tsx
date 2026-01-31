// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('principal-window');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrincipalApp } from './PrincipalApp';
import 'themed-markdown/dist/index.css';
import '../styles/tailwind.css';
import '../index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(<PrincipalApp />);
