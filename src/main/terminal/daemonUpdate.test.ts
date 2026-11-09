jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => mockWindows },
}));
jest.mock('./TerminalOwnershipManager', () => ({
  ownershipManager: { removeSession: jest.fn() },
}));
jest.mock('../terminalEnvironment', () => ({}));
jest.mock('./daemonSpawner', () => ({
  ensureDaemonRunning: jest.fn(),
  restartDaemon: jest.fn(),
  stopDaemon: jest.fn(),
}));
jest.mock('../stores/userPreferencesHandler', () => ({
  UserPreferencesHandler: {
    getInstance: () => ({
      getUserPreferences: async () => ({ usePtyDaemon: true }),
    }),
  },
}));
jest.mock('../repository-monitoring/ipcHandlers', () => ({}));
jest.mock('../telemetry', () => ({ getTracer: () => ({}) }));

import {
  TerminalSessionManager,
  initializeDaemonModeSetting,
} from './TerminalSessionManager';
import {
  ensureDaemonRunning,
  restartDaemon,
  stopDaemon,
} from './daemonSpawner';
import type { TerminalSession } from './types';
import type { DaemonBuildMismatch } from '../../shared/pty-daemon/buildIdentity';
import type { DaemonStatusInfo } from '../../shared/pty-daemon/protocol';

const mockWindows: Array<{
  isDestroyed: () => boolean;
  webContents: { send: jest.Mock };
}> = [];

const mockedEnsure = ensureDaemonRunning as jest.MockedFunction<
  typeof ensureDaemonRunning
>;
const mockedRestart = restartDaemon as jest.MockedFunction<
  typeof restartDaemon
>;
const mockedStop = stopDaemon as jest.MockedFunction<typeof stopDaemon>;

const outdated: DaemonBuildMismatch = {
  running: { version: '1.0.0', bundleHash: 'old' },
  available: { version: '1.1.0', bundleHash: 'new' },
};

function status(sessionCount: number): DaemonStatusInfo {
  return {
    pid: 42,
    uptime: 1000,
    sessionCount,
    clientCount: 0,
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
    startedAt: new Date(0).toISOString(),
    build: outdated.running ?? undefined,
  };
}

function setup() {
  const manager = new TerminalSessionManager();
  manager['sendToWorker'] = jest.fn();
  manager.broadcastToRendererWindows = jest.fn();
  // The worker is only consulted for presence; messages go through the mock.
  manager['worker'] = {} as never;
  return manager;
}

function workerMessages(manager: TerminalSessionManager): string[] {
  return (manager['sendToWorker'] as jest.Mock).mock.calls.map(
    ([msg]) => (msg as { type: string }).type,
  );
}

function broadcastPhases(): string[] {
  return mockWindows[0].webContents.send.mock.calls
    .filter(([channel]) => channel === 'terminal:daemon-update')
    .map(([, payload]) => (payload as { phase: string }).phase);
}

function exitSession(manager: TerminalSessionManager, sessionId: string) {
  manager['handleWorkerMessage']({
    type: 'SESSION_EXIT',
    id: `exit-${sessionId}`,
    timestamp: Date.now(),
    sessionId,
    exitCode: 0,
  });
}

async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe('outdated PTY daemon replacement', () => {
  beforeEach(() => {
    mockWindows.length = 0;
    mockWindows.push({
      isDestroyed: () => false,
      webContents: { send: jest.fn() },
    });
    mockedEnsure.mockReset();
    mockedRestart.mockReset();
    mockedRestart.mockResolvedValue();
  });

  it('leaves an up-to-date daemon alone', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: status(2),
      outdated: null,
    });

    await manager['initializeDaemonConnection']();

    expect(mockedRestart).not.toHaveBeenCalled();
    expect(workerMessages(manager)).toEqual(['CONNECT_DAEMON']);
    expect(manager.hasPendingDaemonUpdate()).toBe(false);
  });

  it('does not replace a daemon when its status (and session count) is unknown', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: null,
      outdated: null,
    });

    await manager['initializeDaemonConnection']();

    expect(mockedRestart).not.toHaveBeenCalled();
    expect(workerMessages(manager)).toEqual(['CONNECT_DAEMON']);
    expect(manager.hasPendingDaemonUpdate()).toBe(false);
  });

  it('replaces an outdated daemon at launch when it owns no sessions', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: status(0),
      outdated,
    });

    await manager['initializeDaemonConnection']();

    expect(mockedRestart).toHaveBeenCalledTimes(1);
    // The worker must attach to the new daemon, never the one being killed.
    expect(workerMessages(manager)).toEqual(['CONNECT_DAEMON']);
    expect(broadcastPhases()).toEqual(['updating', 'updated']);
    expect(manager.hasPendingDaemonUpdate()).toBe(false);
  });

  it('defers the update while the outdated daemon owns sessions', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: status(2),
      outdated,
    });
    await manager['initializeDaemonConnection']();

    expect(mockedRestart).not.toHaveBeenCalled();
    expect(manager.hasPendingDaemonUpdate()).toBe(true);
    expect(broadcastPhases()).toEqual([]);

    manager
      .getAllSessions()
      .set('a', { id: 'a', directory: '/a' } as TerminalSession);
    manager
      .getAllSessions()
      .set('b', { id: 'b', directory: '/b' } as TerminalSession);

    exitSession(manager, 'a');
    await flush();
    expect(mockedRestart).not.toHaveBeenCalled();

    exitSession(manager, 'b');
    await flush();

    expect(mockedRestart).toHaveBeenCalledTimes(1);
    expect(workerMessages(manager)).toEqual([
      'CONNECT_DAEMON',
      'DISCONNECT_DAEMON',
      'CONNECT_DAEMON',
    ]);
    expect(broadcastPhases()).toEqual(['updating', 'updated']);
    expect(manager.hasPendingDaemonUpdate()).toBe(false);
  });

  it('runs a deferred update once even if cleanup fires twice', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: status(1),
      outdated,
    });
    await manager['initializeDaemonConnection']();
    manager
      .getAllSessions()
      .set('a', { id: 'a', directory: '/a' } as TerminalSession);

    exitSession(manager, 'a');
    exitSession(manager, 'a');
    await flush();

    expect(mockedRestart).toHaveBeenCalledTimes(1);
  });

  it('reports a failed replacement and settles waiting callers', async () => {
    const manager = setup();
    mockedEnsure.mockResolvedValue({
      spawned: false,
      status: status(1),
      outdated,
    });
    mockedRestart.mockRejectedValue(new Error('spawn failed'));
    await manager['initializeDaemonConnection']();
    manager
      .getAllSessions()
      .set('a', { id: 'a', directory: '/a' } as TerminalSession);

    exitSession(manager, 'a');
    await flush();

    expect(broadcastPhases()).toEqual(['updating', 'failed']);
    expect(workerMessages(manager)).toEqual([
      'CONNECT_DAEMON',
      'DISCONNECT_DAEMON',
    ]);
    expect(manager['daemonConnectedPromise']).toBeNull();
    expect(manager['daemonUpdateInFlight']).toBe(false);
  });
});

describe('stopping and starting the PTY daemon from the monitor', () => {
  beforeAll(() => initializeDaemonModeSetting());

  beforeEach(() => {
    mockWindows.length = 0;
    mockWindows.push({
      isDestroyed: () => false,
      webContents: { send: jest.fn() },
    });
    mockedEnsure.mockReset();
    mockedRestart.mockReset();
    mockedStop.mockReset();
    mockedStop.mockResolvedValue();
    mockedEnsure.mockResolvedValue({
      spawned: true,
      status: null,
      outdated: null,
    });
  });

  function connect(manager: TerminalSessionManager) {
    manager['handleWorkerMessage']({
      type: 'DAEMON_CONNECTED',
      id: 'c',
      timestamp: Date.now(),
    });
  }

  function disconnect(manager: TerminalSessionManager) {
    manager['handleWorkerMessage']({
      type: 'DAEMON_DISCONNECTED',
      id: 'd',
      timestamp: Date.now(),
    });
  }

  function exitBroadcasts(manager: TerminalSessionManager): string[] {
    return (manager.broadcastToRendererWindows as jest.Mock).mock.calls
      .filter(([channel]) => channel === 'terminal:exit')
      .map(([, payload]) => (payload as { sessionId: string }).sessionId);
  }

  it('stop detaches the worker, kills the daemon, and closes its sessions', async () => {
    const manager = setup();
    await manager['initializeDaemonConnection']();
    connect(manager);
    manager
      .getAllSessions()
      .set('a', { id: 'a', directory: '/a' } as TerminalSession);

    await manager.stopDaemon();

    expect(workerMessages(manager)).toEqual([
      'CONNECT_DAEMON',
      'DISCONNECT_DAEMON',
    ]);
    expect(mockedStop).toHaveBeenCalledTimes(1);
    expect(exitBroadcasts(manager)).toEqual(['a']);
    expect(manager.getAllSessions().size).toBe(0);
    expect(manager['isDaemonConnected']).toBe(false);
    expect(manager['daemonConnectedPromise']).toBeNull();
  });

  it('start respawns the daemon and reattaches the worker', async () => {
    const manager = setup();
    manager['isWorkerReady'] = true;
    await manager['initializeDaemonConnection']();
    connect(manager);
    await manager.stopDaemon();
    disconnect(manager);

    const started = manager.startDaemon();
    await flush();
    expect(mockedEnsure).toHaveBeenCalledTimes(2);
    expect(workerMessages(manager)).toEqual([
      'CONNECT_DAEMON',
      'DISCONNECT_DAEMON',
      'CONNECT_DAEMON',
    ]);
    connect(manager);
    await started;

    expect(manager['isDaemonConnected']).toBe(true);
  });

  it('a session request after an unexpected disconnect reconnects instead of failing', async () => {
    const manager = setup();
    manager['isWorkerReady'] = true;
    await manager['initializeDaemonConnection']();
    connect(manager);
    manager
      .getAllSessions()
      .set('a', { id: 'a', directory: '/a' } as TerminalSession);

    disconnect(manager);
    expect(exitBroadcasts(manager)).toEqual(['a']);

    const ready = manager['ensureDaemonReady']();
    await flush();
    expect(workerMessages(manager)).toEqual([
      'CONNECT_DAEMON',
      'CONNECT_DAEMON',
    ]);
    connect(manager);

    expect(await ready).toBe(true);
  });
});
