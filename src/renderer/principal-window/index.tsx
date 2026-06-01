// Initialize telemetry before any other code
import { initializeTelemetry } from '../telemetry';
initializeTelemetry('principal-window');

import React from 'react';
import { createRoot } from 'react-dom/client';
import mermaid from 'mermaid';
import { PrincipalApp } from './PrincipalApp';
import 'themed-markdown/dist/index.css';
import '../styles/tailwind.css';
import '../index.css';

// Initialize mermaid and expose to window so themed-markdown's
// IndustryMermaidDiagram (which reads window.mermaid) can render diagrams.
// Without this, mermaid blocks flash a placeholder and never paint.
mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
  securityLevel: 'loose',
});
// @ts-expect-error - mermaid is not a standard window property
window.mermaid = mermaid;
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
