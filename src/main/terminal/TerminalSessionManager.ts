import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import {
  app,
  BrowserWindow,
  MessageChannelMain,
  utilityProcess,
  UtilityProcess,
} from 'electron';
import { TerminalSession } from './types';
import type {
  TerminalSessionMetadata,
  TerminalActivityState,
} from '../../shared/tipc/terminalRouterTypes';
import { ownershipManager } from './TerminalOwnershipManager';
import { terminalEnvironment } from '../terminalEnvironment';
import { TerminalAPIEvents } from '../../shared/main-process-api-interfaces/TerminalService';
import { ensureDaemonRunning } from './daemonSpawner';
import { SOCKET_PATH } from '../../shared/pty-daemon/constants';

// Feature flag for daemon mode (enabled by default, set USE_PTY_DAEMON=false to disable)
const USE_DAEMON_MODE = process.env.USE_PTY_DAEMON !== 'false';
import type {
  MainToWorkerMessage,
  WorkerToMainMessage,
  CreateSessionMessage,
  DestroySessionMessage,
  WriteToSessionMessage,
  ResizeSessionMessage,
  RefreshSessionMessage,
  RegisterPortMessage,
  UnregisterPortMessage,
  SetOwnerMessage,
  ConnectDaemonMessage,
  DisconnectDaemonMessage,
  DaemonSessionInfo,
} from '../../terminal-worker/types';

/**
 * Minimal interface for WebSocket bridge to avoid circular dependency
 * Defines only the methods that TerminalSessionManager needs to call
 */
interface TerminalWebSocketBridge {
  onSessionCreated(sessionId: string): Promise<void>;
  onSessionDestroyed(sessionId: string): Promise<void>;
}

export class TerminalSessionManager {
  // Minimal session state in main - just enough to track existence and metadata
  private sessions: Map<string, TerminalSession> = new Map();
  private sessionsByRepo: Map<string, string> = new Map(); // "repoPath:context" -> sessionId
  private maxSessions = 20;
  private rendererWindows: Set<BrowserWindow> = new Set();

  // Activity tracking - which terminals have agents actively working
  private activityStore: Map<string, TerminalActivityState> = new Map();

  // WebSocket bridge for remote terminal access (optional)
  private wsBridge: TerminalWebSocketBridge | null = null;

  // Data listeners for PTY output (for remote streaming)
  private dataListeners: Map<
    string,
    (sessionId: string, data: string) => void
  > = new Map();

  // Utility process worker
  private worker: UtilityProcess | null = null;
  private isWorkerReady = false;
  private pendingMessages: MainToWorkerMessage[] = [];
  private workerReadyPromise: Promise<void> | null = null;
  private workerReadyResolve: (() => void) | null = null;

  // Pending session creation callbacks
  private pendingSessionCallbacks: Map<
    string,
    { resolve: (sessionId: string) => void; reject: (error: Error) => void }
  > = new Map();
  private workerReadyReject: ((error: Error) => void) | null = null;

  // Track MessageChannels - we only keep track of which ports exist, the actual data flows worker<->renderer
  private sessionPorts: Map<string, Map<number, MessageChannelMain>> =
    new Map();

  // Daemon connection state
  private isDaemonConnected = false;
  private daemonConnectedPromise: Promise<void> | null = null;
  private daemonConnectedResolve: (() => void) | null = null;

  constructor() {
    this.initializeWorker();
  }

  /**
   * Set the WebSocket bridge for remote terminal access
   */
  setWebSocketBridge(bridge: TerminalWebSocketBridge): void {
    this.wsBridge = bridge;
    console.log('[TerminalSessionManager] WebSocket bridge set');
  }

  /**
   * Add a listener for PTY data output (for remote streaming)
   * Returns a listener ID that can be used to remove the listener
   */
  addDataListener(
    listenerId: string,
    callback: (sessionId: string, data: string) => void,
  ): void {
    this.dataListeners.set(listenerId, callback);
    console.log(
      `[TerminalSessionManager] Added data listener: ${listenerId}`,
    );
  }

  /**
   * Remove a data listener
   */
  removeDataListener(listenerId: string): void {
    this.dataListeners.delete(listenerId);
    console.log(
      `[TerminalSessionManager] Removed data listener: ${listenerId}`,
    );
  }

  /**
   * Notify all data listeners about PTY output
   * This should be called when PTY data is received
   */
  private notifyDataListeners(sessionId: string, data: string): void {
    for (const [listenerId, callback] of this.dataListeners.entries()) {
      try {
        callback(sessionId, data);
      } catch (error) {
        console.error(
          `[TerminalSessionManager] Error in data listener ${listenerId}:`,
          error,
        );
      }
    }
  }

  // =============================================================================
  // Worker Management
  // =============================================================================

  private async initializeWorker(): Promise<void> {
    if (this.worker) return;

    // Create promise for ready state
    this.workerReadyPromise = new Promise((resolve, reject) => {
      this.workerReadyResolve = resolve;
      this.workerReadyReject = reject;
    });

    // Ensure app is ready
    if (!app.isReady()) {
      await app.whenReady();
    }

    let workerPath: string;

    if (!app.isPackaged) {
      // Development: use the webpack-compiled bundle
      workerPath = path.join(__dirname, 'terminal-worker.bundle.dev.js');
      console.log(
        `[Terminal] Looking for development worker at: ${workerPath}`,
      );
    } else {
      // Production: use the webpack-compiled bundle
      workerPath = path.join(__dirname, 'terminal-worker.js');
      console.log(`[Terminal] Looking for production worker at: ${workerPath}`);
    }

    // Verify the worker file exists
    if (!fs.existsSync(workerPath)) {
      const error = new Error(
        `Worker bundle not found at: ${workerPath}. Terminal will not be available.`,
      );
      console.error(`[Terminal] ${error.message}`);
      if (this.workerReadyReject) {
        this.workerReadyReject(error);
      }
      return;
    }

    console.log(`[Terminal] Spawning terminal worker from: ${workerPath}`);

    this.worker = utilityProcess.fork(workerPath, [], {
      serviceName: 'terminal-worker',
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development',
      },
    });

    this.worker.on('spawn', () => {
      console.log('[Terminal] Worker spawned successfully');
    });

    this.worker.on('message', (msg: WorkerToMainMessage) => {
      this.handleWorkerMessage(msg);
    });

    // Handle stdout/stderr
    if (this.worker.stdout) {
      this.worker.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[TerminalWorker stdout] ${output}`);
        }
      });
    }

    if (this.worker.stderr) {
      this.worker.stderr.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[TerminalWorker stderr] ${output}`);
        }
      });
    }

    this.worker.on('exit', (code: number) => {
      console.warn(`[Terminal] Worker exited with code ${code}`);
      this.worker = null;

      // Reject ready promise if worker exits before ready
      if (!this.isWorkerReady && this.workerReadyReject) {
        this.workerReadyReject(
          new Error(`Terminal worker exited with code ${code}`),
        );
      }

      this.isWorkerReady = false;

      // Fail any pending session callbacks
      for (const [, callback] of this.pendingSessionCallbacks) {
        callback.reject(new Error('Terminal worker exited'));
      }
      this.pendingSessionCallbacks.clear();
    });
  }

  private handleWorkerMessage(msg: WorkerToMainMessage): void {
    switch (msg.type) {
      case 'READY':
        console.log(`[Terminal] Worker is ready (mode: ${USE_DAEMON_MODE ? 'DAEMON' : 'LEGACY'})`);
        this.isWorkerReady = true;
        if (this.workerReadyResolve) {
          this.workerReadyResolve();
        }
        // Flush pending messages
        for (const pending of this.pendingMessages) {
          this.sendToWorker(pending);
        }
        this.pendingMessages = [];

        // In daemon mode, start daemon and connect worker to it
        if (USE_DAEMON_MODE) {
          this.initializeDaemonConnection();
        }
        break;

      case 'SESSION_CREATED': {
        const callback = this.pendingSessionCallbacks.get(msg.sessionId);
        if (callback) {
          if (msg.success) {
            callback.resolve(msg.sessionId);
          } else {
            callback.reject(new Error(msg.error || 'Failed to create session'));
          }
          this.pendingSessionCallbacks.delete(msg.sessionId);
        }
        break;
      }

      case 'SESSION_EXIT':
        this.broadcastToRendererWindows(TerminalAPIEvents.ON_EXIT, {
          sessionId: msg.sessionId,
          code: msg.exitCode,
        });
        this.cleanupSession(msg.sessionId);
        break;

      case 'SESSION_ERROR':
        console.error(
          `[Terminal] Session error for ${msg.sessionId}: ${msg.error}`,
        );
        break;

      case 'WORKER_ERROR':
        console.error(`[Terminal] Worker error: ${msg.error}`, msg.context);
        break;

      case 'DAEMON_CONNECTED':
        console.log('[Terminal] Worker connected to PTY daemon');
        this.isDaemonConnected = true;
        if (this.daemonConnectedResolve) {
          this.daemonConnectedResolve();
        }
        break;

      case 'DAEMON_DISCONNECTED':
        console.warn(
          '[Terminal] Worker disconnected from PTY daemon:',
          msg.error,
        );
        this.isDaemonConnected = false;
        break;

      case 'DAEMON_SESSIONS':
        console.log(
          `[Terminal] Received ${msg.sessions.length} existing sessions from daemon`,
        );
        this.restoreSessionsFromDaemon(msg.sessions);
        break;
    }
  }

  /**
   * Initialize daemon and connect worker to it
   */
  private async initializeDaemonConnection(): Promise<void> {
    try {
      // Create promise for daemon connection
      this.daemonConnectedPromise = new Promise((resolve) => {
        this.daemonConnectedResolve = resolve;
      });

      // Ensure daemon is running
      console.log('[Terminal] Starting PTY daemon...');
      await ensureDaemonRunning();
      console.log('[Terminal] PTY daemon is running');

      // Tell worker to connect to daemon
      const connectMsg: ConnectDaemonMessage = {
        type: 'CONNECT_DAEMON',
        id: 'connect-daemon',
        timestamp: Date.now(),
        socketPath: SOCKET_PATH,
      };
      this.sendToWorker(connectMsg);
    } catch (error) {
      console.error('[Terminal] Failed to initialize daemon connection:', error);
    }
  }

  /**
   * Restore sessions received from daemon after app restart
   */
  private restoreSessionsFromDaemon(daemonSessions: DaemonSessionInfo[]): void {
    console.log(`[Terminal] Restoring ${daemonSessions.length} sessions from daemon`);

    for (const info of daemonSessions) {
      // Check if we already have this session
      if (this.sessions.has(info.id)) {
        console.log(`[Terminal] Session ${info.id} already exists, skipping`);
        continue;
      }

      // Create session tracking in main
      const session: TerminalSession = {
        id: info.id,
        pty: null as unknown as ReturnType<typeof import('node-pty').spawn>,
        directory: info.cwd,
        context: undefined,
        createdAt: new Date(info.createdAt).getTime(),
        lastActivity: new Date(info.lastActivity).getTime(),
        repoPath: undefined, // Will be detected below
        repoId: undefined,
        owner: null,
        remoteAttachments: new Set(),
      };
      this.sessions.set(info.id, session);
      this.sessionPorts.set(info.id, new Map());

      // Try to find git root for restored session
      this.findGitRoot(info.cwd).then((repoPath) => {
        if (repoPath) {
          session.repoPath = repoPath;
          this.getRepoIdFromPath(repoPath).then((repoId) => {
            session.repoId = repoId;
          });
        }
      });

      console.log(`[Terminal] Restored session ${info.id} (cwd: ${info.cwd})`);
    }

    // Broadcast to renderers that sessions were restored
    if (daemonSessions.length > 0) {
      this.broadcastToRendererWindows(TerminalAPIEvents.SESSIONS_RESTORED, {
        sessions: daemonSessions.map((s) => ({
          id: s.id,
          directory: s.cwd,
          createdAt: new Date(s.createdAt).getTime(),
        })),
      });
    }
  }

  private sendToWorker(message: MainToWorkerMessage): void {
    if (!this.worker) {
      console.error('[Terminal] Cannot send message: worker not available');
      return;
    }

    if (!this.isWorkerReady) {
      this.pendingMessages.push(message);
      return;
    }

    try {
      this.worker.postMessage(message);
    } catch (error) {
      console.error('[Terminal] Failed to send message to worker:', error);
    }
  }

  private async ensureWorkerReady(): Promise<boolean> {
    if (this.isWorkerReady) return true;

    if (!this.workerReadyPromise) {
      await this.initializeWorker();
    }

    if (this.workerReadyPromise) {
      // Wait for worker with timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Worker ready timeout')), 10000);
      });

      try {
        await Promise.race([this.workerReadyPromise, timeoutPromise]);
        return this.isWorkerReady;
      } catch (error) {
        console.error('[Terminal] Worker ready failed:', error);
        return false;
      }
    }

    return false;
  }

  /**
   * Ensure terminal backend is ready before creating sessions.
   * In legacy mode, just waits for worker.
   * In daemon mode, also waits for daemon connection.
   */
  private async ensureDaemonReady(): Promise<boolean> {
    // First ensure worker is ready
    const workerReady = await this.ensureWorkerReady();
    if (!workerReady) return false;

    // In legacy mode, worker ready is sufficient
    if (!USE_DAEMON_MODE) {
      return true;
    }

    // In daemon mode, also wait for daemon connection
    if (this.isDaemonConnected) return true;

    // Wait for daemon connection
    if (this.daemonConnectedPromise) {
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Daemon connection timeout')), 15000);
      });

      try {
        await Promise.race([this.daemonConnectedPromise, timeoutPromise]);
        return this.isDaemonConnected;
      } catch (error) {
        console.error('[Terminal] Daemon connection failed:', error);
        return false;
      }
    }

    return false;
  }

  // =============================================================================
  // Renderer Window Tracking
  // =============================================================================

  addRendererWindow(window: BrowserWindow): void {
    if (!window || this.rendererWindows.has(window)) {
      return;
    }

    this.rendererWindows.add(window);

    const cleanup = () => {
      this.rendererWindows.delete(window);
      this.cleanupWindowPorts(window.id);
      ownershipManager.cleanupWindow(window.id);
      window.removeListener('closed', cleanup);
    };

    window.on('closed', cleanup);
  }

  broadcastToRendererWindows(channel: string, payload: unknown): void {
    for (const rendererWindow of Array.from(this.rendererWindows)) {
      if (rendererWindow.isDestroyed()) {
        this.rendererWindows.delete(rendererWindow);
        continue;
      }

      try {
        rendererWindow.webContents.send(channel, payload);
      } catch (error) {
        console.warn(
          `[Terminal] Failed to send ${channel} to window ${rendererWindow.id}:`,
          error,
        );
      }
    }
  }

  // =============================================================================
  // Session Management
  // =============================================================================

  getSessionKey(directory: string, context?: string): string {
    return `${directory}:${context || 'default'}`;
  }

  getSessionByRepoKey(sessionKey: string): TerminalSession | null {
    const sessionId = this.sessionsByRepo.get(sessionKey);
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId) ?? null;
    }
    return null;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getAllSessions(): Map<string, TerminalSession> {
    return this.sessions;
  }

  canCreateSession(): boolean {
    return this.sessions.size < this.maxSessions;
  }

  getMaxSessions(): number {
    return this.maxSessions;
  }

  async createSession(
    directory: string,
    context?: string,
    command?: string,
    metadata?: TerminalSessionMetadata,
  ): Promise<string> {
    const isReady = await this.ensureDaemonReady();
    if (!isReady) {
      throw new Error('Terminal daemon not available');
    }

    const sessionId = uuidv4();
    const claudeSessionId = `terminal-${sessionId}`;

    console.log(
      `[Terminal] Creating session ${sessionId} with CLAUDE_SESSION_ID=${claudeSessionId} in: ${directory}`,
    );

    // Validate directory
    let workingDirectory = directory;
    if (!workingDirectory || !fs.existsSync(workingDirectory)) {
      console.warn(
        `[Terminal] Directory ${workingDirectory} does not exist, using home`,
      );
      const os = require('os');
      workingDirectory =
        process.env.HOME || process.env.USERPROFILE || os.homedir();
    }

    // Get shell and environment
    const shell = terminalEnvironment.getUserShell();
    const rawEnv = await terminalEnvironment.getTerminalEnvironment(
      workingDirectory,
      claudeSessionId,
    );
    // Filter out undefined values for worker
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(rawEnv)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Determine repository info from directory
    const repoPath = await this.findGitRoot(workingDirectory);
    const repoId = repoPath ? await this.getRepoIdFromPath(repoPath) : undefined;

    // Create session tracking in main (minimal state)
    const now = Date.now();
    const session: TerminalSession = {
      id: sessionId,
      pty: null as unknown as ReturnType<typeof import('node-pty').spawn>, // PTY is in worker
      directory: workingDirectory,
      context,
      createdAt: now,
      lastActivity: now,
      // WebSocket integration fields
      repoPath,
      repoId,
      owner: null,
      remoteAttachments: new Set(),
      // Dev server metadata
      metadata,
    };
    this.sessions.set(sessionId, session);
    this.sessionPorts.set(sessionId, new Map());

    // Create promise for session creation result
    const resultPromise = new Promise<string>((resolve, reject) => {
      this.pendingSessionCallbacks.set(sessionId, { resolve, reject });
    });

    // Send creation message to worker
    const message: CreateSessionMessage = {
      type: 'CREATE_SESSION',
      id: `create-${sessionId}`,
      timestamp: Date.now(),
      sessionId,
      directory: workingDirectory,
      context,
      command,
      shell,
      env,
    };
    this.sendToWorker(message);

    // Wait for session creation and notify bridge
    const createdSessionId = await resultPromise;

    // Notify WebSocket bridge of new session
    if (this.wsBridge) {
      try {
        await this.wsBridge.onSessionCreated(createdSessionId);
      } catch (error) {
        console.error(
          '[TerminalSessionManager] Error notifying bridge of session creation:',
          error,
        );
      }
    }

    return createdSessionId;
  }

  trackSessionByRepo(sessionKey: string, sessionId: string): void {
    this.sessionsByRepo.set(sessionKey, sessionId);
  }

  cleanupSession(sessionId: string): void {
    this.closeAllPortsForSession(sessionId);
    ownershipManager.removeSession(sessionId);
    this.sessions.delete(sessionId);

    // Clean up activity tracking (prevents ghost entries)
    this.activityStore.delete(sessionId);

    for (const [repo, sid] of Array.from(this.sessionsByRepo.entries())) {
      if (sid === sessionId) {
        this.sessionsByRepo.delete(repo);
        break;
      }
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const message: DestroySessionMessage = {
        type: 'DESTROY_SESSION',
        id: `destroy-${sessionId}`,
        timestamp: Date.now(),
        sessionId,
      };
      this.sendToWorker(message);
      this.cleanupSession(sessionId);

      console.log(`[Terminal] Session destroyed: ${sessionId}`);

      // Notify WebSocket bridge of session destruction
      if (this.wsBridge) {
        try {
          await this.wsBridge.onSessionDestroyed(sessionId);
        } catch (error) {
          console.error(
            '[TerminalSessionManager] Error notifying bridge of session destruction:',
            error,
          );
        }
      }
    }
  }

  destroyAllSessions(): void {
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }
    this.sessions.clear();
    this.sessionsByRepo.clear();
    this.sessionPorts.clear();
    // Note: Don't shutdown worker here - it should stay running for future sessions
  }

  /**
   * Shutdown the terminal worker (called on app quit)
   * Sessions are NOT destroyed - they persist in the daemon for restoration
   */
  shutdown(): void {
    console.log('[Terminal] Shutting down (sessions will persist in daemon)');

    // Close all ports and clean up local state
    // But don't destroy sessions - they persist in daemon
    for (const sessionId of this.sessions.keys()) {
      this.closeAllPortsForSession(sessionId);
      ownershipManager.removeSession(sessionId);
    }
    this.sessions.clear();
    this.sessionsByRepo.clear();
    this.sessionPorts.clear();
    this.activityStore.clear();

    // Tell worker to disconnect from daemon (but not destroy sessions)
    if (this.worker && this.isDaemonConnected) {
      const disconnectMsg: DisconnectDaemonMessage = {
        type: 'DISCONNECT_DAEMON',
        id: 'disconnect-daemon',
        timestamp: Date.now(),
      };
      this.sendToWorker(disconnectMsg);
    }

    // Shutdown worker
    if (this.worker) {
      this.worker.postMessage({
        type: 'SHUTDOWN',
        id: 'shutdown',
        timestamp: Date.now(),
      });
    }

    this.isDaemonConnected = false;
  }

  /**
   * Force destroy all sessions (e.g., user explicitly closes all terminals)
   * This DOES destroy sessions in the daemon
   */
  destroyAllSessionsForce(): void {
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }
    this.sessions.clear();
    this.sessionsByRepo.clear();
    this.sessionPorts.clear();
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      const message: WriteToSessionMessage = {
        type: 'WRITE',
        id: `write-${sessionId}-${Date.now()}`,
        timestamp: Date.now(),
        sessionId,
        data,
      };
      this.sendToWorker(message);
    }
  }

  resizeSession(
    sessionId: string,
    cols: number,
    rows: number,
    force: boolean = false,
  ): void {
    if (this.sessions.has(sessionId)) {
      const message: ResizeSessionMessage = {
        type: 'RESIZE',
        id: `resize-${sessionId}-${Date.now()}`,
        timestamp: Date.now(),
        sessionId,
        cols,
        rows,
        force,
      };
      this.sendToWorker(message);
    }
  }

  refreshSession(sessionId: string): boolean {
    if (this.sessions.has(sessionId)) {
      const message: RefreshSessionMessage = {
        type: 'REFRESH',
        id: `refresh-${sessionId}`,
        timestamp: Date.now(),
        sessionId,
      };
      this.sendToWorker(message);
      return true;
    }
    return false;
  }

  // =============================================================================
  // Activity Tracking
  // =============================================================================

  /**
   * Update the activity state for a terminal session.
   * Called when an agent starts or stops working.
   * Returns the current activity state for broadcasting.
   */
  updateActivity(
    sessionId: string,
    windowId: number,
    isWorking: boolean,
    workingMessage?: string,
    workingSubtitle?: string,
  ): { activities: TerminalActivityState[]; sessionExists: boolean } {
    // Validate session exists
    const sessionExists = this.sessions.has(sessionId);

    if (isWorking) {
      const state: TerminalActivityState = {
        sessionId,
        isWorking,
        workingMessage,
        workingSubtitle,
        windowId,
        timestamp: Date.now(),
      };
      this.activityStore.set(sessionId, state);
    } else {
      this.activityStore.delete(sessionId);
    }

    return {
      activities: Array.from(this.activityStore.values()),
      sessionExists,
    };
  }

  /**
   * Get all current activity states.
   */
  getActivityState(): TerminalActivityState[] {
    return Array.from(this.activityStore.values());
  }

  /**
   * Get the activity store size (for telemetry).
   */
  getActivityStoreSize(): number {
    return this.activityStore.size;
  }

  // =============================================================================
  // MessagePort Management
  // =============================================================================

  /**
   * Create a MessageChannel for a session and transfer ports:
   * - port1 goes to utility process (worker)
   * - port2 goes to renderer
   * This allows direct PTY data flow without going through main process.
   */
  createPortForSession(
    sessionId: string,
    windowId: number,
    claimOwnership: boolean = false,
  ): boolean {
    console.log(
      `[Terminal] createPortForSession: sessionId=${sessionId}, windowId=${windowId}, claimOwnership=${claimOwnership}`,
    );

    if (!this.sessions.has(sessionId)) {
      console.error(`[Terminal] Session ${sessionId} not found`);
      return false;
    }

    const window = BrowserWindow.fromId(windowId);
    if (!window || window.isDestroyed()) {
      console.error(`[Terminal] Window ${windowId} not found or destroyed`);
      return false;
    }

    // Check if port already exists
    const existingPorts = this.sessionPorts.get(sessionId);
    if (existingPorts?.has(windowId)) {
      console.log(
        `[Terminal] Window ${windowId} already has a port for session ${sessionId}`,
      );
      if (claimOwnership) {
        ownershipManager.claimOwnership(sessionId, windowId);
        // Notify worker of ownership change
        const ownerMsg: SetOwnerMessage = {
          type: 'SET_OWNER',
          id: `set-owner-${sessionId}-${windowId}`,
          timestamp: Date.now(),
          sessionId,
          windowId,
        };
        this.sendToWorker(ownerMsg);
      }
      return true;
    }

    try {
      // Create MessageChannel
      const channel = new MessageChannelMain();

      // Store the channel reference
      let windowPorts = this.sessionPorts.get(sessionId);
      if (!windowPorts) {
        windowPorts = new Map();
        this.sessionPorts.set(sessionId, windowPorts);
      }
      windowPorts.set(windowId, channel);

      // Claim ownership if requested
      if (claimOwnership) {
        ownershipManager.claimOwnership(sessionId, windowId);
      }

      // Send port1 to utility process worker
      const registerMsg: RegisterPortMessage = {
        type: 'REGISTER_PORT',
        id: `register-port-${sessionId}-${windowId}`,
        timestamp: Date.now(),
        sessionId,
        windowId,
        isOwner: claimOwnership,
      };
      this.worker?.postMessage(registerMsg, [channel.port1]);

      // Send port2 to renderer
      window.webContents.postMessage('terminal:port', sessionId, [
        channel.port2,
      ]);

      console.log(
        `[Terminal] Created MessagePort for session ${sessionId} -> window ${windowId}`,
      );

      return true;
    } catch (error) {
      console.error(
        `[Terminal] Failed to create port for session ${sessionId}:`,
        error,
      );
      return false;
    }
  }

  /**
   * @deprecated Use createPortForSession instead
   */
  createMessageChannelForSession(sessionId: string, windowId: number): boolean {
    return this.createPortForSession(sessionId, windowId, true);
  }

  /**
   * Create a monitoring port for the bridge to intercept PTY data
   * This allows remote streaming without affecting renderer ports
   */
  createMonitoringPort(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      console.error(`[Terminal] Session ${sessionId} not found`);
      return false;
    }

    try {
      // Create MessageChannel for monitoring
      const channel = new MessageChannelMain();

      // Set up port2 listener to intercept data and notify listeners
      channel.port2.on('message', (event) => {
        if (event.data && event.data.type === 'DATA') {
          this.notifyDataListeners(sessionId, event.data.data);
        }
      });

      channel.port2.start();

      // Send port1 to worker with a special monitoring windowId (-1)
      const registerMsg: RegisterPortMessage = {
        type: 'REGISTER_PORT',
        id: `register-monitor-${sessionId}`,
        timestamp: Date.now(),
        sessionId,
        windowId: -1, // Special ID for monitoring
        isOwner: false,
      };
      this.worker?.postMessage(registerMsg, [channel.port1]);

      console.log(
        `[Terminal] Created monitoring port for session ${sessionId}`,
      );

      return true;
    } catch (error) {
      console.error(
        `[Terminal] Failed to create monitoring port for session ${sessionId}:`,
        error,
      );
      return false;
    }
  }

  private closeAllPortsForSession(sessionId: string): void {
    const windowPorts = this.sessionPorts.get(sessionId);
    if (windowPorts) {
      for (const [windowId, _channel] of windowPorts.entries()) {
        try {
          // Notify worker to unregister port
          const unregisterMsg: UnregisterPortMessage = {
            type: 'UNREGISTER_PORT',
            id: `unregister-port-${sessionId}-${windowId}`,
            timestamp: Date.now(),
            sessionId,
            windowId,
          };
          this.sendToWorker(unregisterMsg);

          // Close our end (port2 was already transferred)
          // Note: port1 was transferred to worker, port2 to renderer
          // We just need to notify them to clean up
        } catch (error) {
          console.error(
            `[Terminal] Error closing port for window ${windowId} on session ${sessionId}:`,
            error,
          );
        }
      }
      this.sessionPorts.delete(sessionId);
    }
  }

  private cleanupWindowPorts(windowId: number): void {
    for (const [sessionId, windowPorts] of this.sessionPorts.entries()) {
      if (windowPorts.has(windowId)) {
        // Notify worker
        const unregisterMsg: UnregisterPortMessage = {
          type: 'UNREGISTER_PORT',
          id: `unregister-port-${sessionId}-${windowId}`,
          timestamp: Date.now(),
          sessionId,
          windowId,
        };
        this.sendToWorker(unregisterMsg);

        windowPorts.delete(windowId);
        console.log(
          `[Terminal] Cleaned up port for window ${windowId} on session ${sessionId}`,
        );
      }
    }
  }

  // =============================================================================
  // Repository Detection (for WebSocket room organization)
  // =============================================================================

  /**
   * Find the git root directory from a given path
   */
  private async findGitRoot(directory: string): Promise<string | undefined> {
    try {
      const fs = require('fs');
      const path = require('path');
      let currentDir = directory;

      // Walk up the directory tree looking for .git
      while (currentDir !== path.dirname(currentDir)) {
        const gitDir = path.join(currentDir, '.git');
        if (fs.existsSync(gitDir)) {
          return currentDir;
        }
        currentDir = path.dirname(currentDir);
      }

      return undefined;
    } catch (error) {
      console.error('[TerminalSessionManager] Error finding git root:', error);
      return undefined;
    }
  }

  /**
   * Get repository ID (owner/repo) from git remote
   */
  private async getRepoIdFromPath(
    repoPath: string,
  ): Promise<string | undefined> {
    try {
      const { execSync } = require('child_process');
      const remoteUrl = execSync('git config --get remote.origin.url', {
        cwd: repoPath,
        encoding: 'utf-8',
      }).trim();

      // Parse GitHub URL to get owner/repo
      // Handles: git@github.com:owner/repo.git or https://github.com/owner/repo.git
      const match = remoteUrl.match(
        /github\.com[:/]([^/]+)\/(.+?)(\.git)?$/,
      );
      if (match) {
        return `${match[1]}/${match[2]}`;
      }

      return undefined;
    } catch (_error) {
      // Not a git repo or no remote configured
      return undefined;
    }
  }
}
