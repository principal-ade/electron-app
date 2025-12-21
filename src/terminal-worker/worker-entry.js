/**
 * Terminal worker entry point
 * Runs in an Electron utility process to keep PTY operations off the main thread
 */
import {
  isMainToWorkerMessage,
  isCreateSessionMessage,
  isDestroySessionMessage,
  isWriteToSessionMessage,
  isResizeSessionMessage,
  isRefreshSessionMessage,
  isRegisterPortMessage,
  isUnregisterPortMessage,
  isSetOwnerMessage,
  isShutdownMessage,
} from './types';
// State
const sessions = new Map();
// sessionId -> windowId -> port
const sessionPorts = new Map();
let pty = null;
// =============================================================================
// PTY Loading
// =============================================================================
function loadPty() {
  try {
    // Use eval to prevent webpack from bundling node-pty
    // eslint-disable-next-line no-eval
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
function sendToMain(message) {
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
function sendToRenderer(sessionId, data) {
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
// Session Management
// =============================================================================
function createSession(sessionId, directory, shell, env, context, command) {
  if (!pty) {
    const errorMsg = {
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
    const session = {
      id: sessionId,
      pty: ptyProcess,
      directory,
      context,
      createdAt: now,
      lastActivity: now,
    };
    sessions.set(sessionId, session);
    sessionPorts.set(sessionId, new Map());
    // Handle PTY data - send to owner via MessagePort
    ptyProcess.onData((data) => {
      session.lastActivity = Date.now();
      sendToRenderer(sessionId, data);
    });
    // Handle PTY exit
    ptyProcess.onExit((exitInfo) => {
      const exitMsg = {
        type: 'SESSION_EXIT',
        id: `session-exit-${sessionId}`,
        timestamp: Date.now(),
        sessionId,
        exitCode: exitInfo.exitCode,
      };
      sendToMain(exitMsg);
      cleanupSession(sessionId);
    });
    // Send success message
    const successMsg = {
      type: 'SESSION_CREATED',
      id: `session-created-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      success: true,
    };
    sendToMain(successMsg);
    // Send initial command or newline
    if (command) {
      setTimeout(() => {
        ptyProcess.write(`${command}\r`);
      }, 500);
    } else {
      setTimeout(() => {
        ptyProcess.write('\r');
      }, 200);
    }
  } catch (error) {
    const errorMsg = {
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
function destroySession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      session.pty.kill();
    } catch (error) {
      console.error(
        `[TerminalWorker] Error killing PTY for session ${sessionId}:`,
        error,
      );
    }
    cleanupSession(sessionId);
  }
}
function cleanupSession(sessionId) {
  // Close all ports for this session
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
function writeToSession(sessionId, data) {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
    session.pty.write(data);
  }
}
function resizeSession(sessionId, cols, rows, force) {
  const session = sessions.get(sessionId);
  if (session) {
    if (force) {
      // Force SIGWINCH by temporarily changing dimensions
      session.pty.resize(cols + 1, rows);
      session.pty.resize(cols, rows);
    } else {
      session.pty.resize(cols, rows);
    }
  }
}
function refreshSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.pty.write('\x0c'); // Ctrl+L
  }
}
// =============================================================================
// Port Management
// =============================================================================
function registerPort(sessionId, windowId, port, isOwner) {
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
  // Listen for messages from renderer
  port.on('message', (event) => {
    handleRendererMessage(sessionId, event.data);
  });
  if (isOwner) {
    session.ownerWindowId = windowId;
  }
  console.info(
    `[TerminalWorker] Registered port for session ${sessionId} -> window ${windowId} (owner: ${isOwner})`,
  );
}
function unregisterPort(sessionId, windowId) {
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
  // Clear owner if this was the owner
  const session = sessions.get(sessionId);
  if (session && session.ownerWindowId === windowId) {
    session.ownerWindowId = undefined;
  }
}
function setOwner(sessionId, windowId) {
  const session = sessions.get(sessionId);
  if (session) {
    session.ownerWindowId = windowId;
  }
}
function handleRendererMessage(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) return;
  if (message.type === 'WRITE') {
    session.lastActivity = Date.now();
    session.pty.write(message.data);
  } else if (message.type === 'RESIZE') {
    session.pty.resize(message.cols, message.rows);
  }
}
// =============================================================================
// Message Handling
// =============================================================================
function extractMessage(raw) {
  if (raw && typeof raw === 'object' && 'data' in raw) {
    return raw.data;
  }
  return raw;
}
function extractPorts(raw) {
  if (raw && typeof raw === 'object' && 'ports' in raw) {
    return raw.ports || [];
  }
  return [];
}
function handleMessage(rawMessage) {
  const message = extractMessage(rawMessage);
  const ports = extractPorts(rawMessage);
  if (!isMainToWorkerMessage(message)) {
    console.warn(
      '[TerminalWorker] Ignoring message with unexpected shape:',
      rawMessage,
    );
    return;
  }
  if (isCreateSessionMessage(message)) {
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
  } else if (isShutdownMessage(message)) {
    shutdown();
  }
}
// =============================================================================
// Lifecycle
// =============================================================================
function shutdown() {
  console.info('[TerminalWorker] Shutting down...');
  // Destroy all sessions
  for (const sessionId of sessions.keys()) {
    destroySession(sessionId);
  }
  process.exit(0);
}
function initialize() {
  // Load node-pty
  pty = loadPty();
  if (!pty) {
    const errorMsg = {
      type: 'WORKER_ERROR',
      id: 'init-error',
      timestamp: Date.now(),
      error: 'Failed to load node-pty',
    };
    sendToMain(errorMsg);
    process.exit(1);
    return;
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
  const errorMsg = {
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
  const errorMsg = {
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
