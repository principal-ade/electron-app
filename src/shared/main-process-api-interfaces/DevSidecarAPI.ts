import type {
  DevServerDescriptor,
  DevServerLogEntry,
  DevServerStatusPayload,
} from '../types/devServer.types';

export enum DevSidecarEvent {
  CREATE_WINDOW = 'dev-sidecar:create',
  DESTROY_WINDOW = 'dev-sidecar:destroy',
  FOCUS_WINDOW = 'dev-sidecar:focus',
  SERVER_START = 'dev-sidecar:server:start',
  SERVER_STOP = 'dev-sidecar:server:stop',
  SERVER_RESTART = 'dev-sidecar:server:restart',
  SERVER_STATUS = 'dev-sidecar:server:status',
  RELOAD = 'dev-sidecar:reload',
  NAVIGATE = 'dev-sidecar:navigate',
  TOGGLE_DEVTOOLS = 'dev-sidecar:devtools',
  TOGGLE_LOGS = 'dev-sidecar:toggle-logs',
  WINDOW_CREATED = 'dev-sidecar:window:created',
  WINDOW_CLOSED = 'dev-sidecar:window:closed',
  WINDOW_FOCUSED = 'dev-sidecar:window:focused',
  SERVER_STARTED = 'dev-sidecar:server:started',
  SERVER_STOPPED = 'dev-sidecar:server:stopped',
  SERVER_ERROR = 'dev-sidecar:server:error',
  SERVER_OUTPUT = 'dev-sidecar:server:output',
  LOGS_TOGGLED = 'dev-sidecar:logs:toggled',
  GET_BUFFERED_LOGS = 'dev-sidecar:server:get-buffered',
}

export interface CreateDevSidecarWindowPayload {
  terminalSessionId?: string;
  devServerUrl?: string;
  sessionId?: string;
  windowOptions?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
}

export interface DevSidecarWindowInfo {
  sessionId: string;
  windowId: number;
}

export interface StartDevSidecarServerPayload {
  sessionId: string;
  projectPath: string;
  descriptor?: Partial<DevServerDescriptor>;
  port?: number;
  buildFirst?: boolean;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  readyPattern?: string;
}

export interface StopDevSidecarServerPayload {
  sessionId: string;
}

export interface RestartDevSidecarServerPayload {
  sessionId: string;
  newPort?: number;
}

export interface DevSidecarServerStatusResponse
  extends DevServerStatusPayload {}

export interface DevSidecarAPI {
  createWindow: (
    payload: CreateDevSidecarWindowPayload,
  ) => Promise<DevSidecarWindowInfo>;
  destroyWindow: (sessionId: string) => Promise<{ success: boolean }>;
  focusWindow: (sessionId: string) => Promise<{ success: boolean }>;
  startServer: (
    payload: StartDevSidecarServerPayload,
  ) => Promise<DevSidecarServerStatusResponse>;
  stopServer: (
    payload: StopDevSidecarServerPayload,
  ) => Promise<{ success: boolean }>;
  restartServer: (
    payload: RestartDevSidecarServerPayload,
  ) => Promise<DevSidecarServerStatusResponse>;
  getStatus: (sessionId: string) => Promise<DevSidecarServerStatusResponse>;
  reload: (sessionId: string, clearCache?: boolean) => Promise<void>;
  navigate: (sessionId: string, path: string) => Promise<void>;
  toggleDevTools: (sessionId: string) => Promise<void>;
  toggleLogs: (sessionId: string) => Promise<{ visible: boolean }>;
  getBufferedLogs: (sessionId: string) => Promise<DevServerLogEntry[]>;
  onWindowCreated: (
    listener: (info: DevSidecarWindowInfo) => void,
  ) => () => void;
  onWindowClosed: (listener: (sessionId: string) => void) => () => void;
  onWindowFocused: (listener: (sessionId: string) => void) => () => void;
  onServerStarted: (
    listener: (payload: DevSidecarServerStatusResponse) => void,
  ) => () => void;
  onServerStopped: (
    listener: (payload: DevSidecarServerStatusResponse) => void,
  ) => () => void;
  onServerError: (
    listener: (payload: DevSidecarServerStatusResponse) => void,
  ) => () => void;
  onServerOutput: (listener: (entry: DevServerLogEntry) => void) => () => void;
  onLogsToggled: (
    listener: (payload: { sessionId: string; visible: boolean }) => void,
  ) => () => void;
  onServerStatus: (
    listener: (payload: DevSidecarServerStatusResponse) => void,
  ) => () => void;
}
