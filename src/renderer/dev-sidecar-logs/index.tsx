import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidecarLogsApp } from './logsApp';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Dev sidecar logs root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <SidecarLogsApp />
  </React.StrictMode>,
);
