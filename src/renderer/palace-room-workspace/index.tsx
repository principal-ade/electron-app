import React from 'react';
import { createRoot } from 'react-dom/client';
import { PalaceRoomWorkspaceApp } from './PalaceRoomWorkspaceApp';
import 'themed-markdown/dist/index.css';
import '../styles/tailwind.css';
import '../index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Failed to find root element');
}

const root = createRoot(container);
root.render(<PalaceRoomWorkspaceApp />);
