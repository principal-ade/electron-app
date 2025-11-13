# WebRTC Terminal Implementation: Desktop App ↔ Web-ADE

## Overview

This document describes the implementation plan for connecting the Principal ADE desktop-app (Electron) to web-ade (Next.js web app) using WebRTC to stream terminal data from node-pty processes to browser-based xterm.js instances.

## Architecture

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Web Browser (web-ade)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │  RemoteTerminal Component (React)                           │    │
│  │  ┌──────────────────┐        ┌─────────────────────┐       │    │
│  │  │   xterm.js       │◄───────┤  WebRTC Client      │       │    │
│  │  │   (Display)      │        │  (simple-peer)      │       │    │
│  │  └──────────────────┘        └─────────────────────┘       │    │
│  │         │ user input                   │                    │    │
│  │         └──────────────────────────────┘                    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   │ WebRTC DataChannel
                                   │ (DTLS Encrypted)
                                   │
┌──────────────────────────────────┴───────────────────────────────────┐
│                   Desktop App (Electron)                              │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │           Renderer Process (WebRTC Handler)                  │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │  TerminalPeerManager (extends PeerManager)            │   │    │
│  │  │  - Manages WebRTC connections                         │   │    │
│  │  │  - Routes terminal messages                           │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  └───────────────────────────────┬─────────────────────────────┘    │
│                                  │ IPC                               │
│  ┌───────────────────────────────┴─────────────────────────────┐    │
│  │              Main Process (Terminal Manager)                 │    │
│  │  ┌────────────────────────────────────────────────────┐     │    │
│  │  │  TerminalManager                                    │     │    │
│  │  │  - Session management                               │     │    │
│  │  │  - Remote terminal tracking                         │     │    │
│  │  └────────────────┬───────────────────────────────────┘     │    │
│  │                   │                                          │    │
│  │         ┌─────────┴──────────┐                              │    │
│  │         ▼                    ▼                              │    │
│  │  ┌──────────────┐    ┌──────────────┐                      │    │
│  │  │  node-pty    │    │  node-pty    │                      │    │
│  │  │  (Session 1) │    │  (Session 2) │                      │    │
│  │  └──────────────┘    └──────────────┘                      │    │
│  │                                                              │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Connection Types

- **Local Terminal**: Current implementation - Electron app spawns PTY, displays in local xterm.js
- **Remote Terminal**: New implementation - Electron app spawns PTY, streams to web-ade via WebRTC

## Implementation Milestones

---

## Milestone 1: WebRTC Connection Establishment 🎯

**Goal**: Establish authenticated WebRTC peer connection between desktop-app and web-ade with basic data exchange.

### 1.1 Prerequisites

**Desktop App (electron-app):**
- ✅ Already has `simple-peer` dependency
- ✅ Already has `PeerManager` class at `src/renderer/services/p2p/PeerManager.ts`
- ✅ Already has WebSocket client (`GitSyncWebSocketManager`) at `src/main/services/GitSyncWebSocketManager.ts`

**Web-ADE:**
- ❌ Needs `simple-peer` dependency
- ❌ Needs WebSocket client (currently uses `repository-traffic-controller` but not implemented yet)
- ❌ Needs WebRTC peer management

### 1.2 Signaling Architecture

Use the existing `repository-traffic-controller` WebSocket server for WebRTC signaling:

```
Desktop App                 Traffic Controller              Web-ADE
    │                              │                           │
    │──── connect (WS) ────────────▶│                           │
    │                              │◄──── connect (WS) ─────────│
    │                              │                           │
    │──── rtc:offer ───────────────▶│                           │
    │                              │──── rtc:offer ────────────▶│
    │                              │                           │
    │                              │◄──── rtc:answer ──────────│
    │◄──── rtc:answer ─────────────│                           │
    │                              │                           │
    │──── rtc:ice-candidate ───────▶│──── rtc:ice-candidate ───▶│
    │◄──── rtc:ice-candidate ───────│◄──── rtc:ice-candidate ───│
    │                              │                           │
    │◄═══════════════ WebRTC DataChannel ═══════════════════════▶│
    │                 (Direct P2P Connection)                   │
```

### 1.3 Message Protocol for Signaling

```typescript
// Shared types for signaling
type SignalingMessage =
  | {
      type: 'rtc:offer';
      from: string;        // sender's user ID
      to: string;          // recipient's user ID
      sessionId: string;   // unique connection ID
      signal: SimplePeer.SignalData;
    }
  | {
      type: 'rtc:answer';
      from: string;
      to: string;
      sessionId: string;
      signal: SimplePeer.SignalData;
    }
  | {
      type: 'rtc:ice-candidate';
      from: string;
      to: string;
      sessionId: string;
      signal: SimplePeer.SignalData;
    }
  | {
      type: 'rtc:connection-error';
      from: string;
      to: string;
      sessionId: string;
      error: string;
    };
```

### 1.4 Desktop App Changes

#### 1.4.1 Extend PeerManager for Terminal Connections

**File**: `src/renderer/services/p2p/TerminalPeerManager.ts` (new file)

```typescript
import SimplePeer from 'simple-peer';
import { PeerManager } from './PeerManager';

export interface TerminalPeerConfig {
  peerId: string;           // Web-ADE user/session ID
  initiator: boolean;       // Desktop app is usually NOT initiator
  onMessage: (message: TerminalMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export class TerminalPeerManager extends PeerManager {
  private terminalPeers: Map<string, SimplePeer.Instance> = new Map();

  /**
   * Create a WebRTC peer connection for terminal streaming
   */
  createTerminalPeer(config: TerminalPeerConfig): SimplePeer.Instance {
    const peer = new SimplePeer({
      initiator: config.initiator,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    // Handle signaling data (to send via WebSocket)
    peer.on('signal', (signal) => {
      this.sendSignalingMessage({
        type: config.initiator ? 'rtc:offer' : 'rtc:answer',
        from: this.localUserId,
        to: config.peerId,
        sessionId: this.generateSessionId(),
        signal,
      });
    });

    // Handle connection established
    peer.on('connect', () => {
      console.log(`[TerminalPeer] Connected to ${config.peerId}`);
      config.onConnect();
    });

    // Handle incoming data
    peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString()) as TerminalMessage;
        config.onMessage(message);
      } catch (error) {
        console.error('[TerminalPeer] Invalid message received:', error);
      }
    });

    // Handle disconnection
    peer.on('close', () => {
      console.log(`[TerminalPeer] Disconnected from ${config.peerId}`);
      this.terminalPeers.delete(config.peerId);
      config.onDisconnect();
    });

    // Handle errors
    peer.on('error', (error) => {
      console.error(`[TerminalPeer] Error with ${config.peerId}:`, error);
      this.sendSignalingMessage({
        type: 'rtc:connection-error',
        from: this.localUserId,
        to: config.peerId,
        sessionId: this.generateSessionId(),
        error: error.message,
      });
    });

    this.terminalPeers.set(config.peerId, peer);
    return peer;
  }

  /**
   * Handle incoming signaling message from WebSocket
   */
  handleSignalingMessage(message: SignalingMessage): void {
    const peer = this.terminalPeers.get(message.from);

    if (peer) {
      peer.signal(message.signal);
    } else if (message.type === 'rtc:offer') {
      // Incoming connection request - auto-accept for now
      // TODO: Add user confirmation in production
      this.createTerminalPeer({
        peerId: message.from,
        initiator: false,
        onMessage: (msg) => this.handleTerminalMessage(message.from, msg),
        onConnect: () => console.log(`Terminal peer ${message.from} connected`),
        onDisconnect: () => console.log(`Terminal peer ${message.from} disconnected`),
      });
    }
  }

  /**
   * Send terminal message to peer
   */
  sendToTerminalPeer(peerId: string, message: TerminalMessage): boolean {
    const peer = this.terminalPeers.get(peerId);
    if (peer && peer.connected) {
      peer.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private sendSignalingMessage(message: SignalingMessage): void {
    // Send via GitSyncWebSocketManager
    window.api.websocket.send(JSON.stringify(message));
  }

  private handleTerminalMessage(peerId: string, message: TerminalMessage): void {
    // Forward to terminal handler (implemented in Milestone 2)
    console.log(`[TerminalPeer] Message from ${peerId}:`, message);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 1.4.2 WebSocket Bridge for Signaling

**File**: `src/main/services/GitSyncWebSocketManager.ts` (extend existing)

Add handler for RTC signaling messages:

```typescript
// In GitSyncWebSocketManager class

private handleMessage(data: any): void {
  // ... existing message handlers ...

  // Add new handler for RTC signaling
  if (data.type?.startsWith('rtc:')) {
    this.handleRTCSignaling(data);
    return;
  }
}

private handleRTCSignaling(message: SignalingMessage): void {
  // Forward to all renderer processes
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send('rtc:signaling', message);
  });
}
```

#### 1.4.3 IPC Bridge

**File**: `src/shared/main-process-api-interfaces/WebSocketService.ts` (extend existing)

```typescript
export interface WebSocketAPI {
  // ... existing methods ...

  onRTCSignaling(callback: (message: SignalingMessage) => void): () => void;
  sendRTCSignaling(message: SignalingMessage): Promise<void>;
}
```

### 1.5 Web-ADE Changes

#### 1.5.1 Install Dependencies

```bash
cd /Users/griever/Developer/web-ade/web-ade
npm install simple-peer @types/simple-peer
```

#### 1.5.2 WebRTC Client Manager

**File**: `src/lib/webrtc/TerminalPeerClient.ts` (new file)

```typescript
'use client';

import SimplePeer from 'simple-peer';

export interface TerminalPeerClientConfig {
  userId: string;
  desktopPeerId: string;
  websocketUrl: string;
  onMessage: (message: any) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

export class TerminalPeerClient {
  private peer: SimplePeer.Instance | null = null;
  private ws: WebSocket | null = null;
  private config: TerminalPeerClientConfig;

  constructor(config: TerminalPeerClientConfig) {
    this.config = config;
  }

  /**
   * Connect to signaling server and initiate WebRTC connection
   */
  async connect(): Promise<void> {
    // Connect to WebSocket signaling server
    this.ws = new WebSocket(this.config.websocketUrl);

    this.ws.onopen = () => {
      console.log('[TerminalPeer] WebSocket connected');

      // Authenticate (TODO: implement proper auth)
      this.ws!.send(JSON.stringify({
        type: 'auth',
        userId: this.config.userId,
        token: 'TODO',
      }));

      // Initiate WebRTC connection (web-ade is initiator)
      this.createPeer(true);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type?.startsWith('rtc:')) {
        this.handleSignalingMessage(message);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[TerminalPeer] WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('[TerminalPeer] WebSocket disconnected');
      this.cleanup();
    };
  }

  private createPeer(initiator: boolean): void {
    this.peer = new SimplePeer({
      initiator,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    // Send signaling data via WebSocket
    this.peer.on('signal', (signal) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: initiator ? 'rtc:offer' : 'rtc:answer',
          from: this.config.userId,
          to: this.config.desktopPeerId,
          sessionId: this.generateSessionId(),
          signal,
        }));
      }
    });

    // Connection established
    this.peer.on('connect', () => {
      console.log('[TerminalPeer] WebRTC connection established');
      this.config.onConnect();
    });

    // Receive data from desktop app
    this.peer.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.config.onMessage(message);
      } catch (error) {
        console.error('[TerminalPeer] Invalid message:', error);
      }
    });

    // Handle disconnection
    this.peer.on('close', () => {
      console.log('[TerminalPeer] WebRTC connection closed');
      this.config.onDisconnect();
      this.cleanup();
    });

    // Handle errors
    this.peer.on('error', (error) => {
      console.error('[TerminalPeer] WebRTC error:', error);
    });
  }

  private handleSignalingMessage(message: any): void {
    if (this.peer) {
      this.peer.signal(message.signal);
    } else if (message.type === 'rtc:answer') {
      // This shouldn't happen (web-ade is always initiator)
      console.warn('[TerminalPeer] Unexpected answer received');
    }
  }

  /**
   * Send message to desktop app
   */
  send(message: any): boolean {
    if (this.peer?.connected) {
      this.peer.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Close connection
   */
  disconnect(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

#### 1.5.3 React Hook for Connection

**File**: `src/lib/webrtc/useTerminalPeerConnection.ts` (new file)

```typescript
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { TerminalPeerClient } from './TerminalPeerClient';

export interface UseTerminalPeerConnectionOptions {
  userId: string;
  desktopPeerId: string;
  websocketUrl?: string;
  autoConnect?: boolean;
}

export function useTerminalPeerConnection(options: UseTerminalPeerConnectionOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<TerminalPeerClient | null>(null);
  const messageHandlersRef = useRef<((message: any) => void)[]>([]);

  const connect = useCallback(async () => {
    try {
      const client = new TerminalPeerClient({
        userId: options.userId,
        desktopPeerId: options.desktopPeerId,
        websocketUrl: options.websocketUrl ||
          'wss://repository-traffic-controller-production.rj36caac972nm.us-east-1.cs.amazonlightsail.com/ws',
        onMessage: (message) => {
          messageHandlersRef.current.forEach(handler => handler(message));
        },
        onConnect: () => {
          setConnected(true);
          setError(null);
        },
        onDisconnect: () => {
          setConnected(false);
        },
      });

      await client.connect();
      clientRef.current = client;
    } catch (err) {
      setError(err as Error);
      setConnected(false);
    }
  }, [options.userId, options.desktopPeerId, options.websocketUrl]);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((message: any) => {
    return clientRef.current?.send(message) || false;
  }, []);

  const onMessage = useCallback((handler: (message: any) => void) => {
    messageHandlersRef.current.push(handler);

    // Return cleanup function
    return () => {
      messageHandlersRef.current = messageHandlersRef.current.filter(h => h !== handler);
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect, connect, disconnect]);

  return {
    connected,
    error,
    connect,
    disconnect,
    send,
    onMessage,
  };
}
```

### 1.6 Testing Connection Establishment

#### 1.6.1 Desktop App Test Component

**File**: `src/renderer/components/TerminalPeerTestPanel.tsx` (new file)

```typescript
import React, { useState, useEffect } from 'react';
import { TerminalPeerManager } from '../services/p2p/TerminalPeerManager';

export const TerminalPeerTestPanel: React.FC = () => {
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const [peerManager] = useState(() => new TerminalPeerManager());

  useEffect(() => {
    // Listen for incoming signaling messages
    const cleanup = window.api.websocket.onRTCSignaling((message) => {
      peerManager.handleSignalingMessage(message);
    });

    return cleanup;
  }, [peerManager]);

  const handleTestMessage = () => {
    const success = peerManager.sendToTerminalPeer('web-ade-user-id', {
      type: 'ping',
      timestamp: Date.now(),
    });

    if (success) {
      setReceivedMessages(prev => [...prev, `Sent ping at ${new Date().toISOString()}`]);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Terminal Peer Connection Test</h2>
      <div>Status: {status}</div>

      <button onClick={handleTestMessage} disabled={status !== 'connected'}>
        Send Test Message
      </button>

      <h3>Received Messages:</h3>
      <ul>
        {receivedMessages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
};
```

#### 1.6.2 Web-ADE Test Page

**File**: `src/app/terminal-test/page.tsx` (new file)

```typescript
'use client';

import { useState } from 'react';
import { useTerminalPeerConnection } from '@/lib/webrtc/useTerminalPeerConnection';

export default function TerminalTestPage() {
  const [messages, setMessages] = useState<string[]>([]);

  const { connected, error, connect, disconnect, send, onMessage } = useTerminalPeerConnection({
    userId: 'web-ade-user-id',
    desktopPeerId: 'desktop-app-user-id',
    autoConnect: false,
  });

  // Listen for messages
  onMessage((message) => {
    setMessages(prev => [...prev, JSON.stringify(message)]);
  });

  const handleSendPing = () => {
    send({
      type: 'ping',
      timestamp: Date.now(),
    });
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Terminal WebRTC Connection Test</h1>

      <div>
        <strong>Status:</strong> {connected ? 'Connected ✅' : 'Disconnected ❌'}
      </div>

      {error && (
        <div style={{ color: 'red' }}>
          <strong>Error:</strong> {error.message}
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <button onClick={connect} disabled={connected}>
          Connect
        </button>
        <button onClick={disconnect} disabled={!connected} style={{ marginLeft: '10px' }}>
          Disconnect
        </button>
        <button onClick={handleSendPing} disabled={!connected} style={{ marginLeft: '10px' }}>
          Send Ping
        </button>
      </div>

      <h2>Received Messages:</h2>
      <ul>
        {messages.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 1.7 Success Criteria

✅ Milestone 1 is complete when:

1. **WebSocket signaling is working** between desktop-app and web-ade
2. **WebRTC peer connection establishes** successfully
3. **Ping/pong messages** can be sent bidirectionally
4. **Connection status** is correctly reflected in both UIs
5. **Reconnection** works after network disruption
6. **Multiple simultaneous connections** are supported (if needed)

### 1.8 Security Considerations for Milestone 1

- [ ] Implement proper JWT authentication before WebRTC connection
- [ ] Validate signaling messages to prevent injection
- [ ] Rate-limit connection attempts to prevent DoS
- [ ] Add user confirmation for incoming connection requests
- [ ] Log all connection attempts for audit trail

### 1.9 Known Limitations

- No authentication implemented (uses placeholder user IDs)
- No encryption on top of DTLS (may be needed for compliance)
- No bandwidth management or QoS
- No fallback to WebSocket if WebRTC fails (TURN server needed)

---

## Milestone 2: Terminal Protocol Implementation

**Goal**: Define and implement the terminal message protocol for creating, controlling, and streaming terminal data.

### 2.1 Terminal Message Types

```typescript
// File: src/shared/types/TerminalProtocol.ts (new file in desktop-app)
// File: src/lib/terminal/protocol.ts (new file in web-ade)

export type TerminalMessage =
  | TerminalCreateRequest
  | TerminalCreateResponse
  | TerminalWriteRequest
  | TerminalDataResponse
  | TerminalResizeRequest
  | TerminalExitNotification
  | TerminalErrorResponse;

export interface TerminalCreateRequest {
  type: 'terminal:create';
  requestId: string;
  cwd: string;
  shell?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface TerminalCreateResponse {
  type: 'terminal:create:response';
  requestId: string;
  success: boolean;
  sessionId?: string;
  error?: string;
}

export interface TerminalWriteRequest {
  type: 'terminal:write';
  sessionId: string;
  data: string; // User input
}

export interface TerminalDataResponse {
  type: 'terminal:data';
  sessionId: string;
  data: string; // Output from PTY
}

export interface TerminalResizeRequest {
  type: 'terminal:resize';
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalExitNotification {
  type: 'terminal:exit';
  sessionId: string;
  exitCode: number;
}

export interface TerminalErrorResponse {
  type: 'terminal:error';
  sessionId?: string;
  requestId?: string;
  error: string;
}
```

### 2.2 Desktop App: Terminal Message Router

**Implementation**: Connect `TerminalPeerManager` to `TerminalManager` via IPC

**File**: `src/renderer/services/p2p/TerminalMessageHandler.ts` (new file)

```typescript
import { TerminalMessage } from '../../../shared/types/TerminalProtocol';
import { TerminalPeerManager } from './TerminalPeerManager';

export class TerminalMessageHandler {
  private remoteSessions: Map<string, string> = new Map(); // sessionId -> peerId

  constructor(private peerManager: TerminalPeerManager) {}

  async handleMessage(peerId: string, message: TerminalMessage): Promise<void> {
    switch (message.type) {
      case 'terminal:create':
        await this.handleCreateRequest(peerId, message);
        break;

      case 'terminal:write':
        await this.handleWriteRequest(peerId, message);
        break;

      case 'terminal:resize':
        await this.handleResizeRequest(peerId, message);
        break;

      default:
        console.warn('[TerminalMessageHandler] Unknown message type:', message);
    }
  }

  private async handleCreateRequest(
    peerId: string,
    request: TerminalCreateRequest
  ): Promise<void> {
    try {
      // Call IPC to create terminal in main process
      const result = await window.api.terminal.create({
        workingDirectory: request.cwd,
        shell: request.shell,
        cols: request.cols || 80,
        rows: request.rows || 30,
        env: request.env,
      });

      const sessionId = result.sessionId;
      this.remoteSessions.set(sessionId, peerId);

      // Subscribe to terminal output
      const cleanup = window.api.terminal.onData((sid, data) => {
        if (sid === sessionId) {
          this.peerManager.sendToTerminalPeer(peerId, {
            type: 'terminal:data',
            sessionId,
            data,
          });
        }
      });

      // Subscribe to terminal exit
      window.api.terminal.onExit((sid, exitCode) => {
        if (sid === sessionId) {
          this.peerManager.sendToTerminalPeer(peerId, {
            type: 'terminal:exit',
            sessionId,
            exitCode,
          });
          cleanup();
          this.remoteSessions.delete(sessionId);
        }
      });

      // Send success response
      this.peerManager.sendToTerminalPeer(peerId, {
        type: 'terminal:create:response',
        requestId: request.requestId,
        success: true,
        sessionId,
      });
    } catch (error: any) {
      // Send error response
      this.peerManager.sendToTerminalPeer(peerId, {
        type: 'terminal:create:response',
        requestId: request.requestId,
        success: false,
        error: error.message,
      });
    }
  }

  private async handleWriteRequest(
    peerId: string,
    request: TerminalWriteRequest
  ): Promise<void> {
    const expectedPeerId = this.remoteSessions.get(request.sessionId);

    if (expectedPeerId !== peerId) {
      this.peerManager.sendToTerminalPeer(peerId, {
        type: 'terminal:error',
        sessionId: request.sessionId,
        error: 'Unauthorized: This terminal belongs to another peer',
      });
      return;
    }

    try {
      await window.api.terminal.write(request.sessionId, request.data);
    } catch (error: any) {
      this.peerManager.sendToTerminalPeer(peerId, {
        type: 'terminal:error',
        sessionId: request.sessionId,
        error: error.message,
      });
    }
  }

  private async handleResizeRequest(
    peerId: string,
    request: TerminalResizeRequest
  ): Promise<void> {
    try {
      await window.api.terminal.resize(request.sessionId, request.cols, request.rows);
    } catch (error: any) {
      this.peerManager.sendToTerminalPeer(peerId, {
        type: 'terminal:error',
        sessionId: request.sessionId,
        error: error.message,
      });
    }
  }

  cleanup(): void {
    // Destroy all remote sessions when peer disconnects
    this.remoteSessions.forEach(async (peerId, sessionId) => {
      await window.api.terminal.destroy(sessionId);
    });
    this.remoteSessions.clear();
  }
}
```

### 2.3 Main Process: Remote Session Tracking

**File**: `src/main/terminal.ts` (extend existing)

Add tracking for remote vs local sessions:

```typescript
interface TerminalSession {
  id: string;
  pty: IPty;
  workingDirectory: string;
  context: string;
  owner: BrowserWindow | null;
  isRemote: boolean;        // NEW: Flag for remote sessions
  remotePeerId?: string;    // NEW: ID of remote peer
}

// Modify create method to accept isRemote flag
export async function createTerminal(
  workingDirectory: string,
  shell?: string,
  isRemote: boolean = false,
  remotePeerId?: string
): Promise<{ sessionId: string }> {
  // ... existing PTY creation code ...

  const session: TerminalSession = {
    id: sessionId,
    pty: ptyProcess,
    workingDirectory,
    context,
    owner: null,
    isRemote,
    remotePeerId,
  };

  // ... rest of implementation ...
}
```

### 2.4 Web-ADE: Remote Terminal Component

**File**: `src/components/terminal/RemoteTerminal.tsx` (new file)

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useTerminalPeerConnection } from '@/lib/webrtc/useTerminalPeerConnection';
import type { TerminalMessage } from '@/lib/terminal/protocol';

export interface RemoteTerminalProps {
  desktopPeerId: string;
  userId: string;
  cwd: string;
  onExit?: (exitCode: number) => void;
}

export function RemoteTerminal({ desktopPeerId, userId, cwd, onExit }: RemoteTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const requestIdRef = useRef<string>('');

  const { connected, send, onMessage } = useTerminalPeerConnection({
    userId,
    desktopPeerId,
    autoConnect: true,
  });

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    // Handle user input
    term.onData((data) => {
      if (sessionId) {
        send({
          type: 'terminal:write',
          sessionId,
          data,
        });
      }
    });

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (sessionId) {
        send({
          type: 'terminal:resize',
          sessionId,
          cols,
          rows,
        });
      }
    });

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Handle window resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, []);

  // Create terminal session when connected
  useEffect(() => {
    if (!connected || !xtermRef.current) return;

    requestIdRef.current = `req-${Date.now()}`;
    const term = xtermRef.current;
    const { cols, rows } = term;

    send({
      type: 'terminal:create',
      requestId: requestIdRef.current,
      cwd,
      cols,
      rows,
    });
  }, [connected, cwd, send]);

  // Handle incoming messages
  useEffect(() => {
    return onMessage((message: TerminalMessage) => {
      const term = xtermRef.current;
      if (!term) return;

      switch (message.type) {
        case 'terminal:create:response':
          if (message.requestId === requestIdRef.current) {
            if (message.success && message.sessionId) {
              setSessionId(message.sessionId);
              term.writeln('Terminal session established ✓');
            } else {
              term.writeln(`\x1b[31mError: ${message.error}\x1b[0m`);
            }
          }
          break;

        case 'terminal:data':
          if (message.sessionId === sessionId) {
            term.write(message.data);
          }
          break;

        case 'terminal:exit':
          if (message.sessionId === sessionId) {
            term.writeln(`\n\x1b[33mProcess exited with code ${message.exitCode}\x1b[0m`);
            onExit?.(message.exitCode);
          }
          break;

        case 'terminal:error':
          if (message.sessionId === sessionId) {
            term.writeln(`\x1b[31mError: ${message.error}\x1b[0m`);
          }
          break;
      }
    });
  }, [onMessage, sessionId, onExit]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {!connected && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#888',
        }}>
          Connecting to desktop app...
        </div>
      )}
      <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
```

### 2.5 Success Criteria

✅ Milestone 2 is complete when:

1. **Terminal creation** request from web-ade creates PTY on desktop-app
2. **User input** from web-ade xterm.js reaches desktop-app PTY
3. **Terminal output** from desktop-app PTY displays in web-ade xterm.js
4. **Resize events** properly adjust PTY dimensions
5. **Terminal exit** notifications are received
6. **Multiple terminals** can be opened simultaneously
7. **Error handling** works for invalid sessions

---

## Milestone 3: Advanced Features & Production Readiness

**Goal**: Add authentication, security, error recovery, and performance optimizations.

### 3.1 Authentication & Authorization

- Implement JWT-based authentication before WebRTC connection
- Add permission system for allowed directories/commands
- Implement session expiration and renewal
- Add audit logging for all terminal actions

### 3.2 Security Hardening

- Command whitelisting/blacklisting
- Path traversal prevention
- Environment variable sanitization
- Rate limiting on terminal creation
- Automatic session timeout for inactive terminals

### 3.3 Performance Optimization

- Message batching for high-frequency output
- Data compression for large payloads
- Backpressure handling when network is slow
- Terminal scrollback buffer limits

### 3.4 Reliability Features

- Automatic reconnection with session restoration
- Graceful degradation when WebRTC fails (fallback to WebSocket)
- Terminal session persistence across disconnections
- Duplicate message detection and prevention

### 3.5 Monitoring & Debugging

- Connection metrics (latency, bandwidth, packet loss)
- Terminal session metrics (lifetime, data volume)
- Debug mode for message logging
- Performance profiling tools

---

## Technical Considerations

### Browser Compatibility

**Supported**:
- Chrome/Edge 90+ (WebRTC support excellent)
- Firefox 88+ (WebRTC support good)
- Safari 15+ (WebRTC support acceptable)

**Known Issues**:
- Safari may require TURN server for corporate networks
- Mobile browsers not primary target (terminal UX poor on mobile)

### Network Requirements

**Firewall/NAT Traversal**:
- STUN server for most home/office networks: ✅
- TURN server may be needed for strict corporate firewalls: ⚠️
- Consider deploying Coturn server if TURN is needed

**Bandwidth Estimation**:
- Typical terminal: 1-5 KB/s
- Heavy output (large logs): up to 100 KB/s
- Multiple terminals: multiply accordingly

### Scaling Considerations

**Current Architecture Limitations**:
- Each web-ade user needs 1 WebRTC connection to desktop-app
- Desktop-app can handle ~100 concurrent WebRTC connections
- Signaling server (traffic-controller) can handle ~10,000 concurrent WebSocket connections

**Future Improvements**:
- Add connection pooling for multiple terminals over single WebRTC connection
- Implement terminal sharing (multiple web-ade users → 1 desktop-app session)
- Add load balancing if multiple desktop-apps available

---

## Rollout Plan

### Phase 1: Internal Testing (Milestone 1)
- Test with development team only
- Verify basic connectivity works
- Gather feedback on UX

### Phase 2: Limited Beta (Milestone 2)
- Invite 10-20 beta users
- Monitor error rates and connection success
- Iterate on protocol based on real-world usage

### Phase 3: General Availability (Milestone 3)
- Full security audit complete
- Performance benchmarks met
- Documentation published
- Support team trained

---

## Success Metrics

### Connection Reliability
- **Target**: 99% WebRTC connection success rate
- **Measurement**: Track connection attempts vs. successful connections

### Latency
- **Target**: < 100ms round-trip time for terminal input
- **Measurement**: Timestamp on client write → server echo

### User Experience
- **Target**: < 3 seconds to first terminal prompt
- **Measurement**: Time from "create terminal" click to ready state

### Stability
- **Target**: < 1% unexpected disconnections
- **Measurement**: Connections closed due to error vs. user-initiated closes

---

## Open Questions

1. **Multi-user terminals**: Should multiple web-ade users be able to share one terminal session? (pair programming use case)

2. **File upload/download**: Should we support file transfer over same WebRTC channel?

3. **Terminal recording**: Should we record terminal sessions for replay/debugging?

4. **Command restrictions**: What commands should be blocked by default? (e.g., `sudo`, `rm -rf`)

5. **TURN server**: Do we need to deploy our own TURN server, or rely on public STUN-only?

---

## Appendix

### A. Useful Resources

- **SimplePeer Docs**: https://github.com/feross/simple-peer
- **xterm.js Docs**: https://xtermjs.org/docs/
- **node-pty**: https://github.com/microsoft/node-pty
- **WebRTC Primer**: https://webrtc.org/getting-started/overview

### B. Troubleshooting Guide

**"WebRTC connection fails"**:
- Check STUN server accessibility
- Verify firewall allows UDP traffic
- Check browser console for ICE candidate errors
- Try adding TURN server

**"Terminal output is garbled"**:
- Check character encoding (should be UTF-8)
- Verify xterm.js version compatibility
- Check for message ordering issues

**"High latency"**:
- Check network conditions (use ping/traceroute)
- Verify WebRTC is using UDP (not fallback to TCP)
- Check for CPU throttling on desktop-app

### C. Code Review Checklist

- [ ] All TypeScript types defined
- [ ] Error handling covers edge cases
- [ ] No hardcoded credentials or secrets
- [ ] Logging added for debugging
- [ ] Tests written for critical paths
- [ ] Documentation updated
- [ ] Security review completed
