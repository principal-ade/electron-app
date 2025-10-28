import React from 'react';
import { createRoot } from 'react-dom/client';
import { WindowSwitcherApp } from './WindowSwitcherApp';
import './window-switcher.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(<WindowSwitcherApp />);
