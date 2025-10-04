import { BrowserWindow, BrowserView, app } from 'electron';
import path from 'path';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import net, { type AddressInfo } from 'net';

import { resolveHtmlPath } from '../util';
import { sendToAllWindows } from './modernWindowManager';
import type {
  CreateDevSidecarWindowPayload,
  RestartDevSidecarServerPayload,
  StartDevSidecarServerPayload,
  DevSidecarServerStatusResponse,
  DevSidecarWindowInfo,
} from '../../shared/main-process-api-interfaces/DevSidecarAPI';
import {
  DevServerDescriptor,
  DevServerLogEntry,
  DevServerProcessState,
  DevServerStatusPayload,
} from '../../shared/types/devServer.types';
import { DevSidecarEvent } from '../../shared/main-process-api-interfaces/DevSidecarAPI';

const DEV_SIDECAR_DEFAULT_PORT = 6006;
const DEV_SIDECAR_TITLEBAR_HEIGHT = 48;
const MAX_LOG_ENTRIES = 2000;

const DEV_SIDECAR_WINDOW_DEFAULTS = {
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  backgroundColor: '#141620',
  titleBarStyle: 'hiddenInset' as const,
  trafficLightPosition: { x: 10, y: 10 },
};

interface DevSidecarSession {
  sessionId: string;
  terminalSessionId?: string;
  window: BrowserWindow;
  devServerView: BrowserView;
  logsView: BrowserView;
  activeView: 'dev-server' | 'logs';
  devServerState?: DevServerProcessState;
  desiredUrl?: string;
}

export class DevSidecarManager extends EventEmitter {
  private sessions = new Map<string, DevSidecarSession>();

  async createWindow(
    payload: CreateDevSidecarWindowPayload,
  ): Promise<DevSidecarWindowInfo> {
    const sessionId = payload.sessionId ?? randomUUID();

    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (!existing.window.isDestroyed()) {
        existing.window.focus();
      }
      return { sessionId, windowId: existing.window.id };
    }

    const window = new BrowserWindow({
      ...DEV_SIDECAR_WINDOW_DEFAULTS,
      ...payload.windowOptions,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: this.getPreloadPath(),
      },
      show: false,
    });

    const devServerView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
        preload: this.getPreloadPath(),
      },
    });

    const logsView = new BrowserView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        preload: this.getPreloadPath(),
      },
    });

    const session: DevSidecarSession = {
      sessionId,
      terminalSessionId: payload.terminalSessionId,
      window,
      devServerView,
      logsView,
      activeView: 'dev-server',
      devServerState: undefined,
      desiredUrl: payload.devServerUrl ?? `http://localhost:${DEV_SIDECAR_DEFAULT_PORT}`,
    };

    this.sessions.set(sessionId, session);

    this.attachWindowListeners(session);

    const [windowUrl, logsUrl] = [
      `${resolveHtmlPath('dev-sidecar.html')}?sessionId=${sessionId}`,
      `${resolveHtmlPath('dev-sidecar-logs.html')}?sessionId=${sessionId}`,
    ];

    await Promise.all([
      window.loadURL(windowUrl),
      logsView.webContents.loadURL(logsUrl).catch((error) => {
        console.error('[DevSidecar] Failed to load logs view', error);
      }),
    ]);

    window.once('ready-to-show', () => {
      this.showView(session, 'dev-server');
      window.show();
      this.layoutActiveView(session);
    });

    sendToAllWindows(DevSidecarEvent.WINDOW_CREATED, {
      sessionId,
      windowId: window.id,
    });
    if (!window.webContents.isDestroyed()) {
      window.webContents.send(DevSidecarEvent.WINDOW_CREATED, {
        sessionId,
        windowId: window.id,
      });
    }

    return { sessionId, windowId: window.id };
  }

  async destroyWindow(sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false };
    }

    await this.stopServer({ sessionId });

    if (!session.window.isDestroyed()) {
      session.window.close();
    } else {
      this.sessions.delete(sessionId);
    }

    return { success: true };
  }

  async focusWindow(sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.window.isDestroyed()) {
      return { success: false };
    }
    session.window.show();
    session.window.focus();
    sendToAllWindows(DevSidecarEvent.WINDOW_FOCUSED, { sessionId });
    return { success: true };
  }

  async toggleLogs(sessionId: string): Promise<{ visible: boolean }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.window.isDestroyed()) {
      return { visible: false };
    }

    const nextView = session.activeView === 'dev-server' ? 'logs' : 'dev-server';
    this.showView(session, nextView);
    const visible = nextView === 'logs';

    sendToAllWindows(DevSidecarEvent.LOGS_TOGGLED, { sessionId, visible });
    if (!session.window.webContents.isDestroyed()) {
      session.window.webContents.send(DevSidecarEvent.LOGS_TOGGLED, {
        sessionId,
        visible,
      });
    }
    if (!session.logsView.webContents.isDestroyed()) {
      session.logsView.webContents.send(DevSidecarEvent.LOGS_TOGGLED, {
        sessionId,
        visible,
      });
    }

    return { visible };
  }

  async reload(sessionId: string, clearCache?: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.devServerView.webContents.isDestroyed()) return;

    if (clearCache) {
      await session.devServerView.webContents.session.clearCache();
    }
    session.devServerView.webContents.reload();
  }

  async navigate(sessionId: string, path: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const baseUrl = session.devServerState?.url ?? session.desiredUrl;
    if (!baseUrl) return;
    const normalizedPath = path.startsWith('http')
      ? path
      : `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    if (!session.devServerView.webContents.isDestroyed()) {
      session.devServerView.webContents.loadURL(normalizedPath);
    }
  }

  async toggleDevTools(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const webContents = session.devServerView.webContents;
    if (webContents.isDestroyed()) return;
    if (webContents.isDevToolsOpened()) {
      webContents.closeDevTools();
    } else {
      webContents.openDevTools({ mode: 'detach' });
    }
  }

  async startServer(
    payload: StartDevSidecarServerPayload,
  ): Promise<DevSidecarServerStatusResponse> {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      throw new Error(`No dev sidecar session for ${payload.sessionId}`);
    }

    if (session.devServerState?.process) {
      await this.stopServer({ sessionId: payload.sessionId });
    }

    const descriptor = this.createDescriptor(payload);
    const state: DevServerProcessState = {
      descriptor,
      status: 'starting',
      logs: [],
      port: descriptor.port,
      startedAt: Date.now(),
    };
    session.devServerState = state;
    session.desiredUrl = this.buildServerUrl(descriptor);

    this.emitStatus(session, {
      sessionId: payload.sessionId,
      status: 'starting',
      port: descriptor.port,
    });

    try {
      if (payload.buildFirst && descriptor.build) {
        await this.runBuildStep(descriptor.build, descriptor.cwd);
      }

      const port = await this.ensurePort(
        descriptor.port ?? DEV_SIDECAR_DEFAULT_PORT,
        descriptor.fallbackPort,
      );
      state.port = port;
      state.descriptor.port = port;
      session.desiredUrl = this.buildServerUrl({
        ...descriptor,
        port,
      });

      const child = spawn(descriptor.command, descriptor.args ?? [], {
        cwd: descriptor.cwd,
        env: {
          ...process.env,
          ...descriptor.env,
          PORT: String(port),
        },
        shell: process.platform === 'win32',
      });

      state.process = child;

      child.stdout.on('data', (data: Buffer) => {
        this.handleProcessOutput(session, 'stdout', data.toString());
        this.checkReady(session, data.toString());
      });
      child.stderr.on('data', (data: Buffer) => {
        this.handleProcessOutput(session, 'stderr', data.toString());
      });
      child.on('close', (code) => {
        this.handleProcessExit(session, code ?? 0);
      });
      child.on('error', (error) => {
        this.handleProcessFailure(session, error);
      });

      return {
        sessionId: payload.sessionId,
        status: state.status,
        port: state.port,
        url: state.url,
        pid: child.pid ?? undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to start dev server';
      state.status = 'error';
      state.lastError = message;
      this.emitStatus(session, {
        sessionId: payload.sessionId,
        status: 'error',
        lastError: message,
      });
      throw error;
    }
  }

  async stopServer(payload: { sessionId: string }): Promise<{ success: boolean }> {
    const session = this.sessions.get(payload.sessionId);
    if (!session || !session.devServerState?.process) {
      if (session?.devServerState) {
        session.devServerState.status = 'stopped';
        session.devServerState.process = null;
        session.devServerState.url = undefined;
        session.devServerState.readyAt = undefined;
        this.emitStatus(session, {
          sessionId: payload.sessionId,
          status: 'stopped',
        });
      }
      return { success: true };
    }

    const { process: child } = session.devServerState;
    if (child && !child.killed) {
      child.removeAllListeners('close');
      child.removeAllListeners('error');
      child.kill();
    }

    session.devServerState.status = 'stopped';
    session.devServerState.process = null;
    session.devServerState.url = undefined;
    session.devServerState.readyAt = undefined;

    this.emitStatus(session, {
      sessionId: payload.sessionId,
      status: 'stopped',
    });

    return { success: true };
  }

  async restartServer(
    payload: RestartDevSidecarServerPayload,
  ): Promise<DevSidecarServerStatusResponse> {
    await this.stopServer({ sessionId: payload.sessionId });
    const session = this.sessions.get(payload.sessionId);
    if (!session?.devServerState) {
      throw new Error('No dev server state to restart');
    }
    const descriptor: DevServerDescriptor = {
      ...session.devServerState.descriptor,
      port: payload.newPort ?? session.devServerState.descriptor.port,
    };
    session.devServerState.descriptor = descriptor;
    return this.startServer({
      sessionId: payload.sessionId,
      projectPath: descriptor.cwd,
      descriptor,
    });
  }

  async getStatus(sessionId: string): Promise<DevSidecarServerStatusResponse> {
    const session = this.sessions.get(sessionId);
    if (!session?.devServerState) {
      return { sessionId, status: 'idle' };
    }
    const state = session.devServerState;
    return {
      sessionId,
      status: state.status,
      url: state.url,
      port: state.port,
      lastError: state.lastError,
      pid: state.process?.pid,
    };
  }

  async getBufferedLogs(sessionId: string): Promise<DevServerLogEntry[]> {
    const session = this.sessions.get(sessionId);
    if (!session?.devServerState) {
      return [];
    }
    return [...session.devServerState.logs];
  }

  private attachWindowListeners(session: DevSidecarSession) {
    const { window, devServerView, logsView } = session;

    window.on('resize', () => this.layoutActiveView(session));
    window.on('close', () => {
      if (!window.isDestroyed()) {
        window.removeBrowserView(devServerView);
        window.removeBrowserView(logsView);
      }
      if (session.devServerState?.process && !session.devServerState.process.killed) {
        session.devServerState.process.kill();
      }
      this.sessions.delete(session.sessionId);
      sendToAllWindows(DevSidecarEvent.WINDOW_CLOSED, {
        sessionId: session.sessionId,
      });
    });
  }

  private showView(
    session: DevSidecarSession,
    view: 'dev-server' | 'logs',
  ) {
    const { window, devServerView, logsView } = session;
    if (window.isDestroyed()) return;

    if (view === 'dev-server') {
      window.setBrowserView(devServerView);
      window.removeBrowserView(logsView);
    } else {
      window.setBrowserView(logsView);
      window.removeBrowserView(devServerView);
    }
    session.activeView = view;
    this.layoutActiveView(session);
  }

  private layoutActiveView(session: DevSidecarSession) {
    const { window } = session;
    if (window.isDestroyed()) return;

    const bounds = window.getContentBounds();
    const targetView = session.activeView === 'dev-server'
      ? session.devServerView
      : session.logsView;

    targetView.setBounds({
      x: 0,
      y: DEV_SIDECAR_TITLEBAR_HEIGHT,
      width: bounds.width,
      height: Math.max(bounds.height - DEV_SIDECAR_TITLEBAR_HEIGHT, 0),
    });
  }

  private getPreloadPath(): string {
    return app.isPackaged
      ? path.join(__dirname, 'preload.js')
      : path.join(__dirname, '../../.erb/dll/preload.js');
  }

  private createDescriptor(
    payload: StartDevSidecarServerPayload,
  ): DevServerDescriptor {
    const defaultCommand = payload.command ?? 'npm';
    const defaultArgs = payload.command
      ? payload.args ?? []
      : ['run', 'dev'];
    const cwd = payload.descriptor?.cwd ?? payload.projectPath;

    const env = {
      ...(payload.env ?? {}),
      ...(payload.descriptor?.env ?? {}),
    };

    return {
      command: payload.descriptor?.command ?? defaultCommand,
      args: payload.descriptor?.args ?? payload.args ?? defaultArgs,
      cwd,
      env,
      port: payload.descriptor?.port ?? payload.port ?? DEV_SIDECAR_DEFAULT_PORT,
      fallbackPort: payload.descriptor?.fallbackPort,
      readyPattern:
        payload.descriptor?.readyPattern ??
        payload.readyPattern ??
        'Local:\\s+(http://localhost:\\d+)',
      readyTimeoutMs: payload.descriptor?.readyTimeoutMs,
      label: payload.descriptor?.label ?? 'Dev Server',
      urlTemplate: payload.descriptor?.urlTemplate,
      build: payload.descriptor?.build,
    };
  }

  private buildServerUrl(descriptor: DevServerDescriptor): string {
    if (descriptor.urlTemplate) {
      return descriptor.urlTemplate.replace(':port', String(descriptor.port ?? DEV_SIDECAR_DEFAULT_PORT));
    }
    return `http://localhost:${descriptor.port ?? DEV_SIDECAR_DEFAULT_PORT}`;
  }

  private async runBuildStep(
    build: NonNullable<DevServerDescriptor['build']>,
    cwd: string,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const buildProcess = spawn(build.command, build.args ?? [], {
        cwd,
        env: { ...process.env, ...build.env },
        shell: process.platform === 'win32',
      });
      buildProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build command exited with code ${code}`));
        }
      });
      buildProcess.on('error', reject);
    });
  }

  private handleProcessOutput(
    session: DevSidecarSession,
    stream: 'stdout' | 'stderr',
    message: string,
  ) {
    const lines = message.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return;

    const state = session.devServerState;
    if (!state) return;

    for (const line of lines) {
      const entry: DevServerLogEntry = {
        sessionId: session.sessionId,
        stream,
        message: line,
        timestamp: Date.now(),
      };
      state.logs.push(entry);
      if (state.logs.length > MAX_LOG_ENTRIES) {
        state.logs.splice(0, state.logs.length - MAX_LOG_ENTRIES);
      }
      if (!session.logsView.webContents.isDestroyed()) {
        session.logsView.webContents.send(
          DevSidecarEvent.SERVER_OUTPUT,
          entry,
        );
      }
      sendToAllWindows(DevSidecarEvent.SERVER_OUTPUT, entry);
    }
  }

  private handleProcessExit(session: DevSidecarSession, code: number) {
    const state = session.devServerState;
    if (!state) return;
    state.process = null;
    state.status = code === 0 ? 'stopped' : 'error';
    state.url = undefined;
    state.readyAt = undefined;
    const payload: DevServerStatusPayload = {
      sessionId: session.sessionId,
      status: state.status,
    };
    if (code !== 0) {
      payload.lastError = `Dev server exited with code ${code}`;
      state.lastError = payload.lastError;
    }
    this.emitStatus(session, payload);
  }

  private handleProcessFailure(session: DevSidecarSession, error: Error) {
    const state = session.devServerState;
    if (!state) return;
    state.status = 'error';
    state.lastError = error.message;
    this.emitStatus(session, {
      sessionId: session.sessionId,
      status: 'error',
      lastError: error.message,
    });
  }

  private checkReady(session: DevSidecarSession, chunk: string) {
    const state = session.devServerState;
    if (!state || state.status === 'running') {
      return;
    }
    const pattern = state.descriptor.readyPattern
      ? new RegExp(state.descriptor.readyPattern, 'i')
      : /localhost:\d+/i;
    if (pattern.test(chunk)) {
      state.status = 'running';
      state.readyAt = Date.now();
      state.url = this.buildServerUrl({
        ...state.descriptor,
        port: state.port ?? state.descriptor.port,
      });
      this.emitStatus(session, {
        sessionId: session.sessionId,
        status: 'running',
        url: state.url,
        port: state.port,
        pid: state.process?.pid,
      });
      if (state.url) {
        session.devServerView.webContents.loadURL(state.url).catch((error) => {
          console.error('[DevSidecar] Failed to load dev server URL', error);
        });
      }
    }
  }

  private emitStatus(
    session: DevSidecarSession,
    payload: DevServerStatusPayload,
  ) {
    sendToAllWindows(DevSidecarEvent.SERVER_STATUS, payload);
    if (payload.status === 'running') {
      sendToAllWindows(DevSidecarEvent.SERVER_STARTED, payload);
    } else if (payload.status === 'stopped') {
      sendToAllWindows(DevSidecarEvent.SERVER_STOPPED, payload);
    } else if (payload.status === 'error') {
      sendToAllWindows(DevSidecarEvent.SERVER_ERROR, payload);
    }
    if (!session.window.webContents.isDestroyed()) {
      session.window.webContents.send(DevSidecarEvent.SERVER_STATUS, payload);
    }
  }

  private async ensurePort(port: number, fallback?: number): Promise<number> {
    const tryPort = (candidate: number): Promise<number | null> =>
      new Promise((resolve) => {
        const server = net.createServer();
        server.unref();
        server.once('error', () => {
          resolve(null);
        });
        server.listen(candidate, () => {
          const address = server.address() as AddressInfo;
          server.close(() => resolve(address.port));
        });
      });

    const preferred = await tryPort(port);
    if (preferred !== null) {
      return preferred;
    }

    if (fallback) {
      const fallbackPort = await tryPort(fallback);
      if (fallbackPort !== null) {
        return fallbackPort;
      }
    }

    const sessionFallback = await tryPort(port + 1);
    if (sessionFallback !== null) {
      return sessionFallback;
    }

    // As a final fallback, ask the OS for an open port
    const randomPort = await tryPort(0);
    if (randomPort !== null) {
      return randomPort;
    }

    return port;
  }
}
