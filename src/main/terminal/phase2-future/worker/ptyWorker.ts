/**
 * PTY Worker Process
 *
 * This worker runs in an Electron utilityProcess and manages all node-pty instances.
 * It communicates with the main process via process.send/on('message').
 * PTY data is sent back to main process, which forwards it through MessagePorts.
 */

import * as os from 'os';
import { parentPort, MessagePort } from 'worker_threads';
import {
  WorkerControlMessage,
  WorkerEventMessage,
  WorkerSessionInfo,
  PtyDataMessage,
  RendererPortMessage,
} from './types';

/**
 * node-pty module interface (dynamically loaded native module)
 * Using a minimal interface for the methods we actually use
 */
interface NodePtyModule {
  spawn(
    shell: string,
    args: string[],
    options: {
      name: string;
      cols: number;
      rows: number;
      cwd: string;
      env: Record<string, string>;
    },
  ): NodePtyProcess;
}

/**
 * node-pty process interface
 */
interface NodePtyProcess {
  pid: number;
  onData(callback: (data: string) => void): void;
  onExit(callback: (exitInfo: { exitCode: number }) => void): void;
  write(data: string): void;
  resize(cols: number, rows: number): void;
}

// Import node-pty dynamically
let pty: NodePtyModule;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  pty = require('node-pty') as NodePtyModule;
  if (!pty) {
    throw new Error('node-pty unresolved');
  }
} catch (error) {
  console.error('[PTY Worker] node-pty not available:', error);
  process.exit(1);
}

// Map of session ID to session info
const sessions = new Map<string, WorkerSessionInfo>();

// Output buffers for replay/refresh functionality
const outputBuffers = new Map<string, string[]>();
const MAX_BUFFER_SIZE = 1000; // Keep last 1000 chunks

// Pending session creation parameters (waiting for PORT_TRANSFER)
interface PendingSessionParams {
  sessionId: string;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
  shell: string;
  args: string[];
  command?: string;
}
const pendingSessions = new Map<string, PendingSessionParams>();

/**
 * Send a message to the main process via the control channel
 */
function sendToMain(message: WorkerEventMessage): void {
  if (parentPort) {
    parentPort.postMessage(message);
  }
}

/**
 * Create a new PTY session
 */
function createSession(
  sessionId: string,
  cols: number,
  rows: number,
  cwd: string,
  env: Record<string, string>,
  shell: string,
  args: string[],
  port: MessagePort,
  command?: string,
): void {
  try {
    console.log(
      `[PTY Worker] Creating session ${sessionId} in ${cwd} with shell ${shell}`,
    );

    // Validate directory
    const fs = require('fs');
    let workingDirectory = cwd;
    if (!workingDirectory || !fs.existsSync(workingDirectory)) {
      console.warn(
        `[PTY Worker] Directory ${workingDirectory} does not exist, using home directory`,
      );
      workingDirectory = os.homedir();
    }

    // Create PTY process
    let ptyProcess;
    try {
      ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workingDirectory,
        env,
      });
    } catch (spawnError) {
      console.error(
        '[PTY Worker] Failed to spawn shell, trying fallback:',
        spawnError,
      );

      // Try fallback shell
      const fallbackShell =
        process.platform === 'darwin' ? '/bin/bash' : '/bin/sh';
      console.log(`[PTY Worker] Trying fallback shell: ${fallbackShell}`);

      ptyProcess = pty.spawn(fallbackShell, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: workingDirectory,
        env,
      });
    }

    // Initialize output buffer
    outputBuffers.set(sessionId, []);

    // Store session info
    sessions.set(sessionId, {
      sessionId,
      ptyPid: ptyProcess.pid,
      port,
    });

    // Handle PTY data - send to renderer via MessagePort
    ptyProcess.onData((data: string) => {
      const session = sessions.get(sessionId);
      if (!session) return;

      // Buffer the output for replay
      const buffer = outputBuffers.get(sessionId);
      if (buffer) {
        buffer.push(data);
        if (buffer.length > MAX_BUFFER_SIZE) {
          buffer.shift(); // Remove oldest chunk
        }
      }

      // Send to renderer via MessagePort
      const message: PtyDataMessage = {
        type: 'DATA',
        data,
      };
      session.port.postMessage(message);
    });

    // Handle PTY exit
    ptyProcess.onExit((exitInfo: { exitCode: number }) => {
      console.log(
        `[PTY Worker] Session ${sessionId} exited with code ${exitInfo.exitCode}`,
      );

      // Notify main process
      sendToMain({
        type: 'SESSION_EXIT',
        sessionId,
        exitCode: exitInfo.exitCode,
      });

      // Clean up
      const session = sessions.get(sessionId);
      if (session) {
        session.port.close();
      }
      sessions.delete(sessionId);
      outputBuffers.delete(sessionId);
    });

    // Listen for messages from renderer via MessagePort
    port.on('message', (message: RendererPortMessage) => {
      const session = sessions.get(sessionId);
      if (!session) return;

      if (message.type === 'WRITE') {
        ptyProcess.write(message.data);
      } else if (message.type === 'RESIZE') {
        ptyProcess.resize(message.cols, message.rows);
      }
    });

    // Start the port
    port.start();

    // Send initial command if provided
    if (command) {
      setTimeout(() => {
        console.log(
          `[PTY Worker] Sending command for session ${sessionId}: ${command}`,
        );
        ptyProcess.write(`${command}\r`);
      }, 500);
    } else {
      // Send a newline to trigger the shell prompt
      setTimeout(() => {
        console.log(
          `[PTY Worker] Sending initial newline for session ${sessionId}`,
        );
        ptyProcess.write('\r');
      }, 200);
    }

    // Notify main process of successful creation
    sendToMain({
      type: 'SESSION_CREATED',
      sessionId,
      success: true,
    });

    console.log(`[PTY Worker] Session ${sessionId} created successfully`);
  } catch (error) {
    console.error(`[PTY Worker] Failed to create session ${sessionId}:`, error);

    sendToMain({
      type: 'SESSION_CREATED',
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Destroy a PTY session
 */
function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY Worker] Session ${sessionId} not found for destruction`);
    return;
  }

  console.log(`[PTY Worker] Destroying session ${sessionId}`);

  // The PTY process will be killed automatically when we close the session
  // The onExit handler will clean up the rest
  sessions.delete(sessionId);
  outputBuffers.delete(sessionId);
  session.port.close();
}

/**
 * Resize a PTY session
 */
function resizeSession(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY Worker] Session ${sessionId} not found for resize`);
    return;
  }

  // This is handled via the MessagePort from renderer
  // This control message is for future use if needed
  console.log(
    `[PTY Worker] Resize request for session ${sessionId}: ${cols}x${rows}`,
  );
}

/**
 * Write data to a PTY session
 */
function writeSession(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session) {
    console.warn(`[PTY Worker] Session ${sessionId} not found for write`);
    return;
  }

  // This is handled via the MessagePort from renderer
  // This control message is for future use if needed
  console.log(`[PTY Worker] Write request for session ${sessionId}`);
}

/**
 * Handle control messages from main process
 */
if (parentPort) {
  parentPort.on(
    'message',
    (
      message:
        | WorkerControlMessage
        | { type: 'PORT_TRANSFER'; sessionId: string; port: MessagePort },
    ) => {
      try {
        if (message.type === 'CREATE_SESSION') {
          // Port will be sent separately via PORT_TRANSFER
          console.log(
            `[PTY Worker] Received CREATE_SESSION for ${message.sessionId}`,
          );
          // Store the creation params, wait for port
          pendingSessions.set(message.sessionId, {
            sessionId: message.sessionId,
            cols: message.cols,
            rows: message.rows,
            cwd: message.cwd,
            env: message.env,
            shell: message.shell,
            args: message.args,
            command: message.command,
          });
        } else if (message.type === 'PORT_TRANSFER') {
          // Receive the port for a session
          console.log(
            `[PTY Worker] Received PORT_TRANSFER for ${message.sessionId}`,
          );
          const pending = pendingSessions.get(message.sessionId);
          if (pending) {
            createSession(
              pending.sessionId,
              pending.cols,
              pending.rows,
              pending.cwd,
              pending.env,
              pending.shell,
              pending.args,
              message.port,
              pending.command,
            );
            pendingSessions.delete(message.sessionId);
          }
        } else if (message.type === 'DESTROY_SESSION') {
          destroySession(message.sessionId);
        } else if (message.type === 'RESIZE_SESSION') {
          resizeSession(message.sessionId, message.cols, message.rows);
        } else if (message.type === 'WRITE_SESSION') {
          writeSession(message.sessionId, message.data);
        }
      } catch (error) {
        console.error('[PTY Worker] Error handling message:', error);
        sendToMain({
          type: 'WORKER_ERROR',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  );

  // Notify main process that worker is ready
  sendToMain({ type: 'WORKER_READY' });
  console.log('[PTY Worker] Worker process ready');
} else {
  console.error('[PTY Worker] No parent port available');
  process.exit(1);
}

// Handle worker errors
process.on('uncaughtException', (error) => {
  console.error('[PTY Worker] Uncaught exception:', error);
  sendToMain({
    type: 'WORKER_ERROR',
    error: error.message,
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[PTY Worker] Unhandled rejection:', reason);
  sendToMain({
    type: 'WORKER_ERROR',
    error: String(reason),
  });
});
