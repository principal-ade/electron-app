// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('principal-window');

import React from 'react';
import { createRoot } from 'react-dom/client';
import { PrincipalApp } from './PrincipalApp';
import 'themed-markdown/dist/index.css';
import '../styles/tailwind.css';
import '../index.css';
// Required by FileCityTrailExplorerPanel's sequence-view (xyflow). The
// dev-workspace bundle gets this implicitly via @industry-theme/principal-view-panels,
// whose JS bundle inlines and injects these rules on module load; principal-window
// never imports that package, so without this the trail explorer renders unstyled.
import '@xyflow/react/dist/style.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(<PrincipalApp />);
