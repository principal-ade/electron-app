# OpenClaw Integration

This document outlines how to integrate OpenClaw as a managed service within our Electron app, using a WebSocket proxy pattern that avoids forking or modifying the upstream project.

## Overview

**OpenClaw** is a personal AI assistant platform that routes messages between messaging channels (WhatsApp, Telegram, Slack, etc.) and LLM providers (Claude, GPT). It runs as a WebSocket-based gateway daemon.

### Integration Goals

1. Run OpenClaw as a child process managed by the Electron main process
2. Communicate via WebSocket (OpenClaw's native protocol)
3. Expose Electron APIs to OpenClaw agent via a bridge
4. Provide user toggle and settings UI
5. No upstream modifications required

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron App                                                    │
│                                                                  │
│  ┌──────────────────┐     ┌─────────────────────────────────┐  │
│  │  Renderer        │     │  Main Process                    │  │
│  │                  │     │                                  │  │
│  │  Settings UI     │────▶│  OpenClawService                │  │
│  │  Status Display  │ IPC │    - Process lifecycle          │  │
│  │                  │◀────│    - WebSocket client           │  │
│  └──────────────────┘     │    - Electron API bridge        │  │
│                           │                                  │  │
│                           └──────────┬──────────────────────┘  │
│                                      │                          │
│                                      │ WebSocket (ws://127.0.0.1:18789)
│                                      │                          │
│                           ┌──────────▼──────────────────────┐  │
│                           │  OpenClaw Gateway (child proc)   │  │
│                           │    - Agent runtime               │  │
│                           │    - Channel adapters            │  │
│                           │    - Tool execution              │  │
│                           └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation

### 1. OpenClaw Service (Main Process)

Create a service following the `EventServerManager` pattern:

```typescript
// src/main/services/OpenClawService.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { app } from 'electron';
import path from 'path';

export interface OpenClawStatus {
  running: boolean;
  port: number | null;
  connected: boolean;
  restartAttempts: number;
}

export interface OpenClawConfig {
  enabled: boolean;
  port: number;
  restartOnCrash: boolean;
  maxRestartAttempts: number;
}

const DEFAULT_CONFIG: OpenClawConfig = {
  enabled: false,
  port: 18789,
  restartOnCrash: true,
  maxRestartAttempts: 5,
};

class OpenClawService extends EventEmitter {
  private static instance: OpenClawService | null = null;
  private process: ChildProcess | null = null;
  private wsClient: WebSocket | null = null;
  private config: OpenClawConfig = DEFAULT_CONFIG;
  private restartAttempts = 0;
  private shuttingDown = false;
  private pendingToolCalls = new Map<string, { resolve: Function; reject: Function }>();

  static getInstance(): OpenClawService {
    if (!OpenClawService.instance) {
      OpenClawService.instance = new OpenClawService();
    }
    return OpenClawService.instance;
  }

  async start(): Promise<void> {
    if (this.process) {
      console.log('[OpenClaw] Already running');
      return;
    }

    this.shuttingDown = false;

    // Spawn OpenClaw gateway as child process
    // Assumes `openclaw` is installed globally or in PATH
    this.process = spawn('openclaw', ['gateway', 'run', '--port', String(this.config.port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        OPENCLAW_GATEWAY_PORT: String(this.config.port),
      },
    });

    this.process.stdout?.on('data', (data) => {
      console.log(`[OpenClaw stdout] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data) => {
      console.error(`[OpenClaw stderr] ${data.toString().trim()}`);
    });

    this.process.on('spawn', () => {
      console.log('[OpenClaw] Process spawned');
      this.restartAttempts = 0;
      // Wait for gateway to be ready, then connect WebSocket
      setTimeout(() => this.connectWebSocket(), 2000);
    });

    this.process.on('error', (err) => {
      console.error('[OpenClaw] Process error:', err);
      this.emit('error', err);
    });

    this.process.on('exit', (code) => {
      console.log(`[OpenClaw] Process exited with code ${code}`);
      this.process = null;
      this.disconnectWebSocket();
      this.emit('stopped', code);

      if (!this.shuttingDown && this.config.restartOnCrash) {
        this.handleRestart();
      }
    });

    this.emit('started');
  }

  async stop(): Promise<void> {
    this.shuttingDown = true;

    this.disconnectWebSocket();

    if (this.process) {
      // Send graceful shutdown signal
      this.process.kill('SIGTERM');

      // Wait for graceful exit, then force kill
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) {
            console.log('[OpenClaw] Force killing process');
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }

    this.emit('stopped', 0);
  }

  private handleRestart(): void {
    if (this.restartAttempts >= this.config.maxRestartAttempts) {
      console.error('[OpenClaw] Max restart attempts reached');
      this.emit('maxRestartsReached');
      return;
    }

    this.restartAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.restartAttempts - 1), 30000);
    console.log(`[OpenClaw] Restarting in ${delay}ms (attempt ${this.restartAttempts})`);

    setTimeout(() => {
      if (!this.shuttingDown) {
        this.start();
      }
    }, delay);
  }

  // --- WebSocket Connection ---

  private connectWebSocket(): void {
    if (this.wsClient) return;

    const url = `ws://127.0.0.1:${this.config.port}`;
    console.log(`[OpenClaw] Connecting to ${url}`);

    this.wsClient = new WebSocket(url);

    this.wsClient.on('open', () => {
      console.log('[OpenClaw] WebSocket connected');
      this.sendHandshake();
      this.emit('connected');
    });

    this.wsClient.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.wsClient.on('close', () => {
      console.log('[OpenClaw] WebSocket closed');
      this.wsClient = null;
      this.emit('disconnected');
    });

    this.wsClient.on('error', (err) => {
      console.error('[OpenClaw] WebSocket error:', err);
    });
  }

  private disconnectWebSocket(): void {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }

  private sendHandshake(): void {
    // OpenClaw expects a connect frame as first message
    this.send({
      type: 'connect',
      clientName: 'electron-app',
      mode: 'operator',
      protocolVersion: 1,
    });
  }

  private send(payload: object): void {
    if (this.wsClient?.readyState === WebSocket.OPEN) {
      this.wsClient.send(JSON.stringify(payload));
    }
  }

  private handleMessage(msg: any): void {
    // Handle different message types from OpenClaw
    switch (msg.type) {
      case 'res':
        // Response to a request we made
        this.handleResponse(msg);
        break;
      case 'event':
        // Server-push event
        this.handleEvent(msg);
        break;
      case 'tool_call':
        // Agent wants to call an Electron API
        this.handleToolCall(msg);
        break;
    }
  }

  private handleResponse(msg: any): void {
    const pending = this.pendingToolCalls.get(msg.id);
    if (pending) {
      this.pendingToolCalls.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.payload);
      } else {
        pending.reject(new Error(msg.error));
      }
    }
  }

  private handleEvent(msg: any): void {
    this.emit('gatewayEvent', msg.event, msg.payload);
  }

  // --- Electron API Bridge ---

  private async handleToolCall(msg: any): Promise<void> {
    const { callId, toolName, params } = msg;

    try {
      const result = await this.executeElectronTool(toolName, params);
      this.send({
        type: 'tool_result',
        callId,
        success: true,
        result,
      });
    } catch (err) {
      this.send({
        type: 'tool_result',
        callId,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async executeElectronTool(toolName: string, params: any): Promise<any> {
    // Map tool names to Electron API calls
    switch (toolName) {
      case 'electron.showNotification':
        return this.showNotification(params);
      case 'electron.showDialog':
        return this.showDialog(params);
      case 'electron.getClipboard':
        return this.getClipboard();
      case 'electron.setClipboard':
        return this.setClipboard(params);
      case 'electron.openExternal':
        return this.openExternal(params);
      case 'electron.getSystemInfo':
        return this.getSystemInfo();
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Example Electron tool implementations
  private async showNotification(params: { title: string; body: string }): Promise<void> {
    const { Notification } = await import('electron');
    new Notification({ title: params.title, body: params.body }).show();
  }

  private async showDialog(params: { type: string; message: string; buttons?: string[] }): Promise<any> {
    const { dialog, BrowserWindow } = await import('electron');
    const focusedWindow = BrowserWindow.getFocusedWindow();
    return dialog.showMessageBox(focusedWindow!, {
      type: params.type as any,
      message: params.message,
      buttons: params.buttons || ['OK'],
    });
  }

  private async getClipboard(): Promise<string> {
    const { clipboard } = await import('electron');
    return clipboard.readText();
  }

  private async setClipboard(params: { text: string }): Promise<void> {
    const { clipboard } = await import('electron');
    clipboard.writeText(params.text);
  }

  private async openExternal(params: { url: string }): Promise<void> {
    const { shell } = await import('electron');
    await shell.openExternal(params.url);
  }

  private async getSystemInfo(): Promise<object> {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    };
  }

  // --- Public API ---

  getStatus(): OpenClawStatus {
    return {
      running: this.process !== null,
      port: this.process ? this.config.port : null,
      connected: this.wsClient?.readyState === WebSocket.OPEN,
      restartAttempts: this.restartAttempts,
    };
  }

  updateConfig(updates: Partial<OpenClawConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  // Send a message to OpenClaw agent
  async sendMessage(text: string, target?: { channel: string; peer: string }): Promise<any> {
    return this.callMethod('chat.send', { text, target });
  }

  // Call any Gateway RPC method
  async callMethod(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      this.pendingToolCalls.set(id, { resolve, reject });

      this.send({
        type: 'req',
        id,
        method,
        params,
      });

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingToolCalls.has(id)) {
          this.pendingToolCalls.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
}

export const openClawService = OpenClawService.getInstance();
```

### 2. IPC Interface

```typescript
// src/shared/main-process-api-interfaces/OpenClawAPI.ts
export const OpenClawAPIEvents = {
  GET_STATUS: 'openclaw:get-status',
  START: 'openclaw:start',
  STOP: 'openclaw:stop',
  SEND_MESSAGE: 'openclaw:send-message',
  UPDATE_CONFIG: 'openclaw:update-config',
  ON_STATUS_CHANGE: 'openclaw:status-change',
  ON_GATEWAY_EVENT: 'openclaw:gateway-event',
} as const;

export interface OpenClawStatus {
  running: boolean;
  port: number | null;
  connected: boolean;
  restartAttempts: number;
}

export interface OpenClawConfig {
  enabled: boolean;
  port: number;
  restartOnCrash: boolean;
  maxRestartAttempts: number;
}

export interface OpenClawAPI {
  getStatus(): Promise<OpenClawStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendMessage(text: string, target?: { channel: string; peer: string }): Promise<any>;
  updateConfig(updates: Partial<OpenClawConfig>): Promise<void>;
  onStatusChange(callback: (status: OpenClawStatus) => void): void;
  onGatewayEvent(callback: (event: string, payload: any) => void): void;
}
```

### 3. IPC Handler (Main Process)

```typescript
// src/main/services/OpenClawIPC.ts
import { ipcMain, BrowserWindow } from 'electron';
import { OpenClawAPIEvents } from '../../shared/main-process-api-interfaces/OpenClawAPI';
import { openClawService } from './OpenClawService';

export function registerOpenClawIpcHandlers(): void {
  ipcMain.handle(OpenClawAPIEvents.GET_STATUS, () => {
    return openClawService.getStatus();
  });

  ipcMain.handle(OpenClawAPIEvents.START, async () => {
    await openClawService.start();
  });

  ipcMain.handle(OpenClawAPIEvents.STOP, async () => {
    await openClawService.stop();
  });

  ipcMain.handle(OpenClawAPIEvents.SEND_MESSAGE, async (_, text: string, target?: any) => {
    return openClawService.sendMessage(text, target);
  });

  ipcMain.handle(OpenClawAPIEvents.UPDATE_CONFIG, async (_, updates: any) => {
    openClawService.updateConfig(updates);
  });

  // Broadcast status changes to all windows
  openClawService.on('started', () => broadcastStatus());
  openClawService.on('stopped', () => broadcastStatus());
  openClawService.on('connected', () => broadcastStatus());
  openClawService.on('disconnected', () => broadcastStatus());

  openClawService.on('gatewayEvent', (event: string, payload: any) => {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(OpenClawAPIEvents.ON_GATEWAY_EVENT, event, payload);
    });
  });
}

function broadcastStatus(): void {
  const status = openClawService.getStatus();
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send(OpenClawAPIEvents.ON_STATUS_CHANGE, status);
  });
}
```

### 4. Preload Implementation

```typescript
// src/window/main-process-api-implementations/openclawApi.ts
import { ipcRenderer } from 'electron';
import { OpenClawAPIEvents, OpenClawAPI, OpenClawStatus, OpenClawConfig } from '../../shared/main-process-api-interfaces/OpenClawAPI';

export const openclawAPI: OpenClawAPI = {
  getStatus: () => ipcRenderer.invoke(OpenClawAPIEvents.GET_STATUS),
  start: () => ipcRenderer.invoke(OpenClawAPIEvents.START),
  stop: () => ipcRenderer.invoke(OpenClawAPIEvents.STOP),
  sendMessage: (text, target) => ipcRenderer.invoke(OpenClawAPIEvents.SEND_MESSAGE, text, target),
  updateConfig: (updates) => ipcRenderer.invoke(OpenClawAPIEvents.UPDATE_CONFIG, updates),

  onStatusChange: (callback) => {
    ipcRenderer.on(OpenClawAPIEvents.ON_STATUS_CHANGE, (_, status) => callback(status));
  },

  onGatewayEvent: (callback) => {
    ipcRenderer.on(OpenClawAPIEvents.ON_GATEWAY_EVENT, (_, event, payload) => callback(event, payload));
  },
};
```

Add to preload.ts:
```typescript
import { openclawAPI } from './main-process-api-implementations/openclawApi';

contextBridge.exposeInMainWorld('mainProcess', {
  // ...existing APIs
  openclaw: openclawAPI,
});
```

### 5. User Preferences

Add to `userPreferences.types.ts`:

```typescript
export interface UserPreferences {
  // ...existing fields
  openclawEnabled?: boolean;
  openclawPort?: number;
  openclawRestartOnCrash?: boolean;
}
```

### 6. Settings UI Component

```tsx
// src/renderer/principal-window/views/Settings/components/OpenClawSettings.tsx
import React, { useState, useEffect } from 'react';
import { useTheme } from '@/renderer/hooks/useTheme';
import { UserPreferencesService } from '@/renderer/main-process-api/UserPreferencesService';

export function OpenClawSettings() {
  const theme = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [port, setPort] = useState(18789);

  useEffect(() => {
    // Load initial state
    loadPreferences();
    loadStatus();

    // Listen for status updates
    window.mainProcess.openclaw.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });
  }, []);

  const loadPreferences = async () => {
    const prefs = await UserPreferencesService.getPreferences();
    setEnabled(prefs.openclawEnabled ?? false);
    setPort(prefs.openclawPort ?? 18789);
  };

  const loadStatus = async () => {
    const s = await window.mainProcess.openclaw.getStatus();
    setStatus(s);
  };

  const handleToggle = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    await UserPreferencesService.updatePreferences({ openclawEnabled: newEnabled });

    if (newEnabled) {
      await window.mainProcess.openclaw.start();
    } else {
      await window.mainProcess.openclaw.stop();
    }
  };

  const handlePortChange = async (newPort: number) => {
    setPort(newPort);
    await UserPreferencesService.updatePreferences({ openclawPort: newPort });
    await window.mainProcess.openclaw.updateConfig({ port: newPort });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium" style={{ color: theme.text }}>
          OpenClaw Gateway
        </h3>
        <p className="text-sm" style={{ color: theme.textSecondary }}>
          Run a local AI assistant gateway that connects to messaging platforms.
        </p>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between">
        <label className="text-sm" style={{ color: theme.text }}>
          Enable OpenClaw Gateway
        </label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
          className="toggle"
        />
      </div>

      {/* Status Display */}
      {status && (
        <div
          className="p-3 rounded-md text-sm"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                status.connected ? 'bg-green-500' : status.running ? 'bg-yellow-500' : 'bg-gray-500'
              }`}
            />
            <span style={{ color: theme.text }}>
              {status.connected
                ? `Connected (port ${status.port})`
                : status.running
                  ? 'Starting...'
                  : 'Stopped'}
            </span>
          </div>
          {status.restartAttempts > 0 && (
            <p className="mt-1" style={{ color: theme.textSecondary }}>
              Restart attempts: {status.restartAttempts}
            </p>
          )}
        </div>
      )}

      {/* Port Configuration */}
      <div className="flex items-center justify-between">
        <label className="text-sm" style={{ color: theme.text }}>
          Gateway Port
        </label>
        <input
          type="number"
          value={port}
          onChange={(e) => handlePortChange(parseInt(e.target.value, 10))}
          disabled={status?.running}
          className="w-24 px-2 py-1 rounded border"
          style={{
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            color: theme.text,
          }}
        />
      </div>

      {/* Actions */}
      {enabled && (
        <div className="flex gap-2">
          <button
            onClick={() => window.mainProcess.openclaw.start()}
            disabled={status?.running}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: theme.primary,
              color: theme.primaryText,
              opacity: status?.running ? 0.5 : 1,
            }}
          >
            Start
          </button>
          <button
            onClick={() => window.mainProcess.openclaw.stop()}
            disabled={!status?.running}
            className="px-3 py-1 rounded text-sm"
            style={{
              backgroundColor: theme.backgroundSecondary,
              color: theme.text,
              opacity: !status?.running ? 0.5 : 1,
            }}
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
```

### 7. Initialization

Add to `src/main/initialization.ts`:

```typescript
import { openClawService } from './services/OpenClawService';
import { registerOpenClawIpcHandlers } from './services/OpenClawIPC';

export async function initializeServices(): Promise<void> {
  // ...existing initialization

  // Register OpenClaw IPC handlers
  registerOpenClawIpcHandlers();

  // Start OpenClaw if enabled in preferences
  const prefs = await getUserPreferences();
  if (prefs.openclawEnabled) {
    openClawService.updateConfig({ port: prefs.openclawPort ?? 18789 });
    await openClawService.start();
  }
}

export async function shutdownServices(): Promise<void> {
  // ...existing shutdown

  // Stop OpenClaw
  await openClawService.stop();
}
```

## Exposing Electron APIs to OpenClaw Agent

The bridge in `OpenClawService.executeElectronTool()` handles tool calls from the OpenClaw agent. To make these tools available to the agent, you need to register them in OpenClaw's configuration or create a plugin.

### Option A: OpenClaw Plugin (Recommended)

Create an OpenClaw plugin that registers Electron tools:

```typescript
// ~/.openclaw/plugins/electron-bridge/index.ts
export default {
  id: 'electron-bridge',
  name: 'Electron Bridge',

  tools: [
    {
      name: 'electron.showNotification',
      description: 'Show a system notification',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['title', 'body'],
      },
    },
    {
      name: 'electron.showDialog',
      description: 'Show a dialog to the user',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['info', 'warning', 'error', 'question'] },
          message: { type: 'string' },
          buttons: { type: 'array', items: { type: 'string' } },
        },
        required: ['type', 'message'],
      },
    },
    // Add more tools as needed
  ],
};
```

### Option B: Custom Protocol Extension

Extend the WebSocket communication to forward tool calls to the Electron main process. The `handleToolCall` method in `OpenClawService` already handles this pattern.

## Prerequisites

1. **OpenClaw installed**: `npm install -g openclaw` or available in PATH
2. **OpenClaw configured**: Run `openclaw config` to set up credentials
3. **WebSocket dependency**: `npm install ws @types/ws`

## Future Enhancements

- [ ] Bundle OpenClaw as a utility process instead of spawning CLI
- [ ] Add more Electron tools (file dialogs, system info, screenshots)
- [ ] Implement OpenClaw event forwarding to renderer (chat updates, etc.)
- [ ] Add settings for channel configuration
- [ ] Create dedicated OpenClaw panel in the app UI
- [ ] Support multiple agent profiles/workspaces

## References

- [OpenClaw Repository](https://github.com/openclaw/openclaw)
- [OpenClaw Gateway Protocol](https://docs.openclaw.ai/concepts/architecture)
- [EventServerManager Pattern](../src/main/agent-session-events/EventServerManager.ts)
