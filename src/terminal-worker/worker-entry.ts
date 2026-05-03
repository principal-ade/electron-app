/**
 * Terminal worker entry point
 * Runs in an Electron utility process to keep terminal operations off the main thread
 *
 * Supports two modes:
 * - Legacy mode (default): Spawns PTYs directly using node-pty
 * - Daemon mode: Connects to external PTY daemon for session persistence
 *
 * Daemon mode is disabled by default. Set USE_PTY_DAEMON=true to enable.
 */

import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  SessionCreatedMessage,
  SessionExitMessage,
  WorkerErrorMessage,
  RendererToWorkerPortMessage,
  CreateSessionMessage,
  DestroySessionMessage,
  WriteToSessionMessage,
  ResizeSessionMessage,
  RefreshSessionMessage,
  RegisterPortMessage,
  UnregisterPortMessage,
  SetOwnerMessage,
  ShutdownMessage,
  ConnectDaemonMessage,
  DisconnectDaemonMessage,
  DaemonConnectedMessage,
  DaemonDisconnectedMessage,
  DaemonSessionsMessage,
  GetScrollbackMessage,
  ScrollbackResponseMessage,
} from './types';

// Feature flag for daemon mode (disabled by default due to production issues)
const USE_DAEMON_MODE = process.env.USE_PTY_DAEMON === 'true';

// Type guards inlined to avoid webpack module resolution issues
function isMainToWorkerMessage(msg: unknown): msg is MainToWorkerMessage {
  return (
    msg !== null &&
    typeof msg === 'object' &&
    'type' in msg &&
    'id' in msg &&
    'timestamp' in msg
  );
}

function isCreateSessionMessage(
  msg: MainToWorkerMessage,
): msg is CreateSessionMessage {
  return msg.type === 'CREATE_SESSION';
}

function isDestroySessionMessage(
  msg: MainToWorkerMessage,
): msg is DestroySessionMessage {
  return msg.type === 'DESTROY_SESSION';
}

function isWriteToSessionMessage(
  msg: MainToWorkerMessage,
): msg is WriteToSessionMessage {
  return msg.type === 'WRITE';
}

function isResizeSessionMessage(
  msg: MainToWorkerMessage,
): msg is ResizeSessionMessage {
  return msg.type === 'RESIZE';
}

function isRefreshSessionMessage(
  msg: MainToWorkerMessage,
): msg is RefreshSessionMessage {
  return msg.type === 'REFRESH';
}

function isRegisterPortMessage(
  msg: MainToWorkerMessage,
): msg is RegisterPortMessage {
  return msg.type === 'REGISTER_PORT';
}

function isUnregisterPortMessage(
  msg: MainToWorkerMessage,
): msg is UnregisterPortMessage {
  return msg.type === 'UNREGISTER_PORT';
}

function isSetOwnerMessage(msg: MainToWorkerMessage): msg is SetOwnerMessage {
  return msg.type === 'SET_OWNER';
}

function isShutdownMessage(msg: MainToWorkerMessage): msg is ShutdownMessage {
  return msg.type === 'SHUTDOWN';
}

function isConnectDaemonMessage(
  msg: MainToWorkerMessage,
): msg is ConnectDaemonMessage {
  return msg.type === 'CONNECT_DAEMON';
}

function isDisconnectDaemonMessage(
  msg: MainToWorkerMessage,
): msg is DisconnectDaemonMessage {
  return msg.type === 'DISCONNECT_DAEMON';
}

function isGetScrollbackMessage(
  msg: MainToWorkerMessage,
): msg is GetScrollbackMessage {
  return msg.type === 'GET_SCROLLBACK';
}

// MessagePort type for utility process
interface MessagePortLike {
  postMessage: (message: unknown) => void;
  on: (event: 'message', handler: (event: { data: unknown }) => void) => void;
  start: () => void;
  close: () => void;
}

// PTY interface (node-pty types) - only used in legacy mode
interface IPty {
  onData: (callback: (data: string) => void) => void;
  onExit: (callback: (exitInfo: { exitCode: number }) => void) => void;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
}

interface PtySpawnOptions {
  name: string;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
}

interface PtyModule {
  spawn: (shell: string, args: string[], options: PtySpawnOptions) => IPty;
}

// Scrollback buffer settings for legacy mode
const SCROLLBACK_MAX_CHUNKS = 10000; // Max number of data chunks to store
const SCROLLBACK_TRIM_TO = 5000; // Trim to this many chunks when limit is exceeded
const SCROLLBACK_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per session — drops oldest chunks once exceeded

// Session state
interface TerminalSession {
  id: string;
  pty: IPty | null; // Only set in legacy mode
  directory: string;
  context?: string;
  ownerWindowId?: number;
  createdAt: number;
  lastActivity: number;
  scrollback: string[]; // Stores PTY output for replay on reconnection (legacy mode)
  scrollbackBytes: number; // Tracked byte size of scrollback for cap enforcement
}

// State
const sessions: Map<string, TerminalSession> = new Map();
// sessionId -> windowId -> port
const sessionPorts: Map<string, Map<number, MessagePortLike>> = new Map();

// Legacy mode: node-pty module
let pty: PtyModule | null = null;

// Daemon mode: bridge and pending callbacks
let daemonBridge: import('./DaemonBridge').DaemonBridge | null = null;
const pendingCreations: Map<
  string,
  { resolve: () => void; reject: (err: Error) => void }
> = new Map();

// =============================================================================
// PTY Loading (Legacy Mode)
// =============================================================================

function loadPty(): PtyModule | null {
  try {
    // Use eval to prevent webpack from bundling node-pty
    const nodePty = eval('require')('node-pty');
    console.info('[TerminalWorker] node-pty loaded successfully');
    return nodePty;
  } catch (error) {
    console.error('[TerminalWorker] Failed to load node-pty:', error);
    return null;
  }
}

// =============================================================================
// Message Sending
// =============================================================================

function sendToMain(message: WorkerToMainMessage): void {
  try {
    if (process.parentPort) {
      process.parentPort.postMessage(message);
    } else if (process.send) {
      process.send(message);
    } else {
      console.error('[TerminalWorker] No IPC mechanism available');
    }
  } catch (error) {
    console.error('[TerminalWorker] Failed to send message to main:', error);
  }
}

function sendToRenderer(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  const ownerWindowId = session.ownerWindowId;
  if (ownerWindowId === undefined) return;

  const ports = sessionPorts.get(sessionId);
  if (!ports) return;

  const port = ports.get(ownerWindowId);
  if (!port) return;

  try {
    port.postMessage({ type: 'DATA', data });
  } catch (error) {
    console.error(
      `[TerminalWorker] Failed to send data to renderer for session ${sessionId}:`,
      error,
    );
    // Remove broken port
    ports.delete(ownerWindowId);
  }
}

// =============================================================================
// Daemon Connection (Daemon Mode Only)
// =============================================================================

async function connectToDaemon(_socketPath: string): Promise<void> {
  if (!USE_DAEMON_MODE) {
    console.warn('[TerminalWorker] CONNECT_DAEMON received but daemon mode is disabled');
    return;
  }

  if (daemonBridge?.connected) {
    console.warn('[TerminalWorker] Already connected to daemon');
    return;
  }

  // Dynamic import to avoid loading when not in daemon mode
  const { DaemonBridge } = await import('./DaemonBridge');
  daemonBridge = new DaemonBridge();

  // Wire up daemon events
  daemonBridge.on('data', (sessionId: string, data: string) => {
    const session = sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    sendToRenderer(sessionId, data);
  });

  daemonBridge.on('created', (sessionId: string, _pid: number) => {
    const pending = pendingCreations.get(sessionId);
    if (pending) {
      pending.resolve();
      pendingCreations.delete(sessionId);
    }
  });

  daemonBridge.on('exit', (sessionId: string, exitCode: number, _signal?: string) => {
    const exitMsg: SessionExitMessage = {
      type: 'SESSION_EXIT',
      id: `session-exit-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      exitCode,
    };
    sendToMain(exitMsg);
    cleanupSession(sessionId);
  });

  daemonBridge.on('session-error', (sessionId: string, error: string) => {
    const pending = pendingCreations.get(sessionId);
    if (pending) {
      pending.reject(new Error(error));
      pendingCreations.delete(sessionId);
      return;
    }

    sendToMain({
      type: 'SESSION_ERROR',
      id: `session-error-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      error,
    });
  });

  daemonBridge.on('disconnected', (error?: Error) => {
    console.warn('[TerminalWorker] Disconnected from daemon:', error?.message);
    const msg: DaemonDisconnectedMessage = {
      type: 'DAEMON_DISCONNECTED',
      id: 'daemon-disconnected',
      timestamp: Date.now(),
      error: error?.message,
    };
    sendToMain(msg);
  });

  daemonBridge.on('error', (error: Error) => {
    console.error('[TerminalWorker] Daemon bridge error:', error.message);
  });

  try {
    const existingSessions = await daemonBridge.connect();

    console.info(
      `[TerminalWorker] Connected to daemon, ${existingSessions.length} existing sessions`,
    );

    const connectedMsg: DaemonConnectedMessage = {
      type: 'DAEMON_CONNECTED',
      id: 'daemon-connected',
      timestamp: Date.now(),
    };
    sendToMain(connectedMsg);

    if (existingSessions.length > 0) {
      const sessionsMsg: DaemonSessionsMessage = {
        type: 'DAEMON_SESSIONS',
        id: 'daemon-sessions',
        timestamp: Date.now(),
        sessions: existingSessions,
      };
      sendToMain(sessionsMsg);

      for (const info of existingSessions) {
        const session: TerminalSession = {
          id: info.id,
          pty: null,
          directory: info.cwd,
          createdAt: new Date(info.createdAt).getTime(),
          lastActivity: new Date(info.lastActivity).getTime(),
          scrollback: [], // Not used in daemon mode (daemon handles scrollback)
          scrollbackBytes: 0,
        };
        sessions.set(info.id, session);
        sessionPorts.set(info.id, new Map());
      }
    }
  } catch (error) {
    console.error('[TerminalWorker] Failed to connect to daemon:', error);
    const msg: DaemonDisconnectedMessage = {
      type: 'DAEMON_DISCONNECTED',
      id: 'daemon-connect-failed',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
    sendToMain(msg);
    throw error;
  }
}

function disconnectFromDaemon(): void {
  if (daemonBridge) {
    daemonBridge.disconnect();
    daemonBridge = null;
  }
}

// =============================================================================
// Session Management
// =============================================================================

async function createSession(
  sessionId: string,
  directory: string,
  shell: string,
  env: Record<string, string>,
  context?: string,
  command?: string,
): Promise<void> {
  if (USE_DAEMON_MODE) {
    await createSessionDaemon(sessionId, directory, shell, env, context, command);
  } else {
    createSessionLegacy(sessionId, directory, shell, env, context, command);
  }
}

// Legacy mode: spawn PTY directly
function createSessionLegacy(
  sessionId: string,
  directory: string,
  shell: string,
  env: Record<string, string>,
  context?: string,
  command?: string,
): void {
  if (!pty) {
    const errorMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: false,
      error: 'node-pty not available',
    };
    sendToMain(errorMsg);
    return;
  }

  try {
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd: directory,
      env,
    });

    const now = Date.now();
    const session: TerminalSession = {
      id: sessionId,
      pty: ptyProcess,
      directory,
      context,
      createdAt: now,
      lastActivity: now,
      scrollback: [], // Initialize scrollback buffer
      scrollbackBytes: 0,
    };

    sessions.set(sessionId, session);
    sessionPorts.set(sessionId, new Map());

    ptyProcess.onData((data: string) => {
      session.lastActivity = Date.now();

      // Store output in scrollback buffer for replay on reconnection
      session.scrollback.push(data);
      session.scrollbackBytes += data.length;

      // Trim by chunk count
      if (session.scrollback.length > SCROLLBACK_MAX_CHUNKS) {
        const dropped = session.scrollback.splice(0, session.scrollback.length - SCROLLBACK_TRIM_TO);
        for (const chunk of dropped) session.scrollbackBytes -= chunk.length;
      }

      // Trim by byte size — drop oldest chunks until under the cap
      while (session.scrollbackBytes > SCROLLBACK_MAX_BYTES && session.scrollback.length > 1) {
        const dropped = session.scrollback.shift();
        if (dropped) session.scrollbackBytes -= dropped.length;
      }

      sendToRenderer(sessionId, data);
    });

    ptyProcess.onExit((exitInfo: { exitCode: number }) => {
      const exitMsg: SessionExitMessage = {
        type: 'SESSION_EXIT',
        id: `session-exit-${sessionId}`,
        timestamp: Date.now(),
        sessionId,
        exitCode: exitInfo.exitCode,
      };
      sendToMain(exitMsg);
      cleanupSession(sessionId);
    });

    const successMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: true,
    };
    sendToMain(successMsg);

    if (command) {
      setTimeout(() => {
        ptyProcess.write(`${command}\r`);
      }, 500);
    }
    // else {
    //   // Commented out to test fix for duplicate prompt issue
    //   setTimeout(() => {
    //     ptyProcess.write('\r');
    //   }, 200);
    // }
  } catch (error) {
    const errorMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    sendToMain(errorMsg);
  }
}

// Daemon mode: send to daemon
async function createSessionDaemon(
  sessionId: string,
  directory: string,
  shell: string,
  env: Record<string, string>,
  context?: string,
  command?: string,
): Promise<void> {
  if (!daemonBridge?.connected) {
    const errorMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: false,
      error: 'Not connected to daemon',
    };
    sendToMain(errorMsg);
    return;
  }

  try {
    const now = Date.now();
    const session: TerminalSession = {
      id: sessionId,
      pty: null,
      directory,
      context,
      createdAt: now,
      lastActivity: now,
      scrollback: [], // Not used in daemon mode (daemon handles scrollback)
      scrollbackBytes: 0,
    };
    sessions.set(sessionId, session);
    sessionPorts.set(sessionId, new Map());

    const creationPromise = new Promise<void>((resolve, reject) => {
      pendingCreations.set(sessionId, { resolve, reject });
    });

    daemonBridge.send({
      type: 'create',
      id: sessionId,
      cwd: directory,
      shell,
      env,
    });

    await creationPromise;

    const successMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: true,
    };
    sendToMain(successMsg);

    if (command) {
      setTimeout(() => {
        daemonBridge?.send({
          type: 'write',
          id: sessionId,
          data: `${command}\r`,
        });
      }, 500);
    } else {
      setTimeout(() => {
        daemonBridge?.send({
          type: 'write',
          id: sessionId,
          data: '\r',
        });
      }, 200);
    }
  } catch (error) {
    sessions.delete(sessionId);
    sessionPorts.delete(sessionId);

    const errorMsg: SessionCreatedMessage = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    sendToMain(errorMsg);
  }
}

function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (USE_DAEMON_MODE) {
      daemonBridge?.send({
        type: 'destroy',
        id: sessionId,
      });
    } else if (session.pty) {
      try {
        session.pty.kill();
      } catch (error) {
        console.error(
          `[TerminalWorker] Error killing PTY for session ${sessionId}:`,
          error,
        );
      }
    }
    cleanupSession(sessionId);
  }
}

function cleanupSession(sessionId: string): void {
  const ports = sessionPorts.get(sessionId);
  if (ports) {
    for (const port of ports.values()) {
      try {
        port.close();
      } catch {
        // Port may already be closed
      }
    }
    sessionPorts.delete(sessionId);
  }

  sessions.delete(sessionId);
}

function writeToSession(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    if (USE_DAEMON_MODE && daemonBridge?.connected) {
      daemonBridge.send({
        type: 'write',
        id: sessionId,
        data,
      });
    } else if (session.pty) {
      session.pty.write(data);
    }
  }
}

function resizeSession(
  sessionId: string,
  cols: number,
  rows: number,
  force?: boolean,
): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (USE_DAEMON_MODE && daemonBridge?.connected) {
      daemonBridge.send({
        type: 'resize',
        id: sessionId,
        cols,
        rows,
      });
    } else if (session.pty) {
      if (force) {
        session.pty.resize(cols + 1, rows);
        session.pty.resize(cols, rows);
      } else {
        session.pty.resize(cols, rows);
      }
    }
  }
}

function refreshSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    if (USE_DAEMON_MODE && daemonBridge?.connected) {
      daemonBridge.send({
        type: 'write',
        id: sessionId,
        data: '\x0c',
      });
    } else if (session.pty) {
      session.pty.write('\x0c'); // Ctrl+L
    }
  }
}

// =============================================================================
// Port Management
// =============================================================================

function registerPort(
  sessionId: string,
  windowId: number,
  port: MessagePortLike,
  isOwner: boolean,
): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(
      `[TerminalWorker] Cannot register port: session ${sessionId} not found`,
    );
    return;
  }

  let ports = sessionPorts.get(sessionId);
  if (!ports) {
    ports = new Map();
    sessionPorts.set(sessionId, ports);
  }

  ports.set(windowId, port);
  port.start();

  port.on('message', (event: { data: unknown }) => {
    handleRendererMessage(sessionId, event.data as RendererToWorkerPortMessage);
  });

  console.info(
    `[TerminalWorker] registerPort called: sessionId=${sessionId}, windowId=${windowId}, isOwner=${isOwner}`,
  );

  if (isOwner) {
    session.ownerWindowId = windowId;
    console.info(`[TerminalWorker] isOwner=true, checking scrollback...`);

    if (USE_DAEMON_MODE && daemonBridge?.connected) {
      // Daemon mode: request scrollback from daemon
      daemonBridge.send({
        type: 'attach',
        id: sessionId,
      });

      const scrollbackHandler = (scrollbackSessionId: string, data: string) => {
        if (scrollbackSessionId === sessionId && data) {
          sendToRenderer(sessionId, data);
        }
      };
      daemonBridge.once('scrollback', scrollbackHandler);
    } else if (session.scrollback && session.scrollback.length > 0) {
      // Legacy mode: replay stored scrollback to the renderer
      const scrollbackData = session.scrollback.join('');
      console.info(
        `[TerminalWorker] Replaying scrollback for session ${sessionId}: ${session.scrollback.length} chunks, ${scrollbackData.length} bytes`,
      );

      if (scrollbackData) {
        // Small delay to ensure port is ready to receive
        setTimeout(() => {
          console.info(`[TerminalWorker] Sending scrollback to renderer for session ${sessionId}`);
          sendToRenderer(sessionId, scrollbackData);
        }, 50);
      }
    } else {
      console.info(
        `[TerminalWorker] No scrollback to replay for session ${sessionId}: scrollback=${session.scrollback?.length ?? 0} chunks`,
      );
    }
  }

  console.info(
    `[TerminalWorker] Registered port for session ${sessionId} -> window ${windowId} (owner: ${isOwner})`,
  );
}

function unregisterPort(sessionId: string, windowId: number): void {
  const ports = sessionPorts.get(sessionId);
  if (!ports) return;

  const port = ports.get(windowId);
  if (port) {
    try {
      port.close();
    } catch {
      // Port may already be closed
    }
    ports.delete(windowId);
  }

  const session = sessions.get(sessionId);
  if (session && session.ownerWindowId === windowId) {
    session.ownerWindowId = undefined;
  }
}

function setOwner(sessionId: string, windowId: number): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.ownerWindowId = windowId;
  }
}

/**
 * Handle GET_SCROLLBACK request from main process.
 * Returns the scrollback buffer for a session.
 */
function handleGetScrollback(sessionId: string, requestId: string): void {
  const session = sessions.get(sessionId);
  let buffer: string | null = null;

  if (session) {
    if (USE_DAEMON_MODE && daemonBridge?.connected) {
      // Daemon mode: request scrollback from daemon
      // For now, daemon mode scrollback is handled via attach message
      // Return null here - the attach flow handles scrollback replay
      console.info(
        `[TerminalWorker] GET_SCROLLBACK for ${sessionId}: daemon mode, returning null (use attach)`,
      );
      buffer = null;
    } else {
      // Legacy mode: join the scrollback array
      buffer = session.scrollback.join('');
      console.info(
        `[TerminalWorker] GET_SCROLLBACK for ${sessionId}: returning ${buffer.length} bytes from ${session.scrollback.length} chunks`,
      );
    }
  } else {
    console.warn(
      `[TerminalWorker] GET_SCROLLBACK for ${sessionId}: session not found`,
    );
  }

  const response: ScrollbackResponseMessage = {
    type: 'SCROLLBACK_RESPONSE',
    id: `scrollback-response-${requestId}`,
    timestamp: Date.now(),
    sessionId,
    requestId,
    buffer,
  };
  sendToMain(response);
}

function handleRendererMessage(
  sessionId: string,
  message: RendererToWorkerPortMessage,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  if (message.type === 'WRITE') {
    writeToSession(sessionId, message.data);
  } else if (message.type === 'RESIZE') {
    resizeSession(sessionId, message.cols, message.rows);
  }
}

// =============================================================================
// Message Handling
// =============================================================================

function extractMessage(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

function extractPorts(raw: unknown): MessagePortLike[] {
  if (raw && typeof raw === 'object' && 'ports' in raw) {
    return (raw as { ports: MessagePortLike[] }).ports || [];
  }
  return [];
}

function handleMessage(rawMessage: unknown): void {
  const message = extractMessage(rawMessage);
  const ports = extractPorts(rawMessage);

  if (!isMainToWorkerMessage(message)) {
    console.warn(
      '[TerminalWorker] Ignoring message with unexpected shape:',
      rawMessage,
    );
    return;
  }

  if (isConnectDaemonMessage(message)) {
    connectToDaemon(message.socketPath).catch((error) => {
      console.error('[TerminalWorker] Failed to connect to daemon:', error);
    });
  } else if (isDisconnectDaemonMessage(message)) {
    disconnectFromDaemon();
  } else if (isCreateSessionMessage(message)) {
    createSession(
      message.sessionId,
      message.directory,
      message.shell,
      message.env,
      message.context,
      message.command,
    );
  } else if (isDestroySessionMessage(message)) {
    destroySession(message.sessionId);
  } else if (isWriteToSessionMessage(message)) {
    writeToSession(message.sessionId, message.data);
  } else if (isResizeSessionMessage(message)) {
    resizeSession(message.sessionId, message.cols, message.rows, message.force);
  } else if (isRefreshSessionMessage(message)) {
    refreshSession(message.sessionId);
  } else if (isRegisterPortMessage(message)) {
    if (ports.length > 0) {
      registerPort(
        message.sessionId,
        message.windowId,
        ports[0],
        message.isOwner,
      );
    }
  } else if (isUnregisterPortMessage(message)) {
    unregisterPort(message.sessionId, message.windowId);
  } else if (isSetOwnerMessage(message)) {
    setOwner(message.sessionId, message.windowId);
  } else if (isGetScrollbackMessage(message)) {
    handleGetScrollback(message.sessionId, message.requestId);
  } else if (isShutdownMessage(message)) {
    shutdown();
  }
}

// =============================================================================
// Lifecycle
// =============================================================================

function shutdown(): void {
  console.info('[TerminalWorker] Shutting down...');

  if (USE_DAEMON_MODE) {
    // Disconnect from daemon (sessions persist)
    disconnectFromDaemon();
  } else {
    // Destroy all sessions
    for (const sessionId of sessions.keys()) {
      destroySession(sessionId);
    }
  }

  // Close all ports
  for (const ports of sessionPorts.values()) {
    for (const port of ports.values()) {
      try {
        port.close();
      } catch {
        // Port may already be closed
      }
    }
  }
  sessionPorts.clear();
  sessions.clear();

  process.exit(0);
}

function initialize(): void {
  console.info(`[TerminalWorker] Mode: ${USE_DAEMON_MODE ? 'DAEMON' : 'LEGACY'}`);

  if (!USE_DAEMON_MODE) {
    // Legacy mode: load node-pty
    pty = loadPty();

    if (!pty) {
      const errorMsg: WorkerErrorMessage = {
        type: 'WORKER_ERROR',
        id: 'init-error',
        timestamp: Date.now(),
        error: 'Failed to load node-pty',
      };
      sendToMain(errorMsg);
      process.exit(1);
      return;
    }
  }

  // Send ready signal
  sendToMain({
    type: 'READY',
    id: 'ready',
    timestamp: Date.now(),
  });

  console.info('[TerminalWorker] Initialized and ready');
}

// =============================================================================
// Entry Point
// =============================================================================

// Set up message handling
if (process.parentPort) {
  process.parentPort.on('message', handleMessage);
} else {
  process.on('message', handleMessage);
}

// Handle process signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[TerminalWorker] Uncaught exception:', error);
  const errorMsg: WorkerErrorMessage = {
    type: 'WORKER_ERROR',
    id: 'uncaught-exception',
    timestamp: Date.now(),
    error: error.message,
    context: { stack: error.stack },
  };
  sendToMain(errorMsg);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[TerminalWorker] Unhandled rejection:', reason);
  const errorMsg: WorkerErrorMessage = {
    type: 'WORKER_ERROR',
    id: 'unhandled-rejection',
    timestamp: Date.now(),
    error: reason instanceof Error ? reason.message : String(reason),
    context: { stack: reason instanceof Error ? reason.stack : undefined },
  };
  sendToMain(errorMsg);
});

// Initialize
initialize();

console.info('[TerminalWorker] Worker entry point loaded');
