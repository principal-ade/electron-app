import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidecarApp } from './sidecarApp';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Dev sidecar root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <SidecarApp />
  </React.StrictMode>,
);
