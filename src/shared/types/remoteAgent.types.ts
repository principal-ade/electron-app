import { BrowserWindow } from 'electron';

export interface RemoteAgentConfig {
  id: string;                    // Unique identifier for the remote agent
  name: string;                   // Display name
  url: string;                    // Cloud remote agent URL
  icon?: string;                  // Optional icon URL
  capabilities?: string[];        // Remote agent capabilities
  requiresAuth?: boolean;         // Whether auth is required
  metadata?: Record<string, unknown>; // Additional metadata
}

export interface RemoteAgentWindow {
  id: string;                    // Remote agent ID
  windowId: number;               // Electron window ID
  window: BrowserWindow;          // Window instance
  config: RemoteAgentConfig;      // Remote agent configuration
  state: RemoteAgentWindowState;  // Current state
  createdAt: Date;               // Creation timestamp
  lastActiveAt: Date;            // Last activity timestamp
}

export enum RemoteAgentWindowState {
  LOADING = 'loading',
  READY = 'ready',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
  AUTHENTICATED = 'authenticated'
}

export interface RemoteAgentWindowOptions {
  width?: number;
  height?: number;
  alwaysOnTop?: boolean;
  resizable?: boolean;
  position?: { x: number; y: number };
  parentWindow?: BrowserWindow;
}

export type RemoteAgentMessage = Record<string, unknown>;