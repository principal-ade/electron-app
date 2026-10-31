/** @jest-environment node */
/**
 * RepositoryMonitoringManager against the real bundled daemon (dist/daemon)
 * spawned as a plain Node process in a temp home. Electron is mocked (only
 * `app.isReady` and `BrowserWindow.getAllWindows` are touched); everything
 * else goes over the socket.
 *
 * Uses the daemon bundle shipped by repository-monitoring-server.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const mockSentToWindows: { channel: string; payload: unknown }[] = [];

jest.mock('electron', () => ({
  app: {
    isReady: () => true,
    whenReady: () => Promise.resolve(),
    getAppPath: () => '/mock/app/path',
    get isPackaged() {
      return false;
    },
  },
  BrowserWindow: {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, payload: unknown) => {
            mockSentToWindows.push({ channel, payload });
          },
        },
      },
    ],
  },
}));

jest.mock('./logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  configureMainLogging: jest.fn(),
  getLogFilePath: () => '/mock/log/path/main.log',
}));

import { RepositoryMonitoringManager } from './RepositoryMonitoringManager';
import { probeDaemon } from '@principal-ai/repository-monitoring-server/client';

const DAEMON_BUNDLE =
  require.resolve('@principal-ai/repository-monitoring-server/dist/daemon/repository-monitoring-daemon.js');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeRepo(dir: string): string {
  const repo = path.join(dir, 'repo');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'a.ts'), 'export const a = 1;\n');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: repo });
  return repo;
}

describe('RepositoryMonitoringManager (daemon transport)', () => {
  let home: string;
  let socketPath: string;
  let repo: string;
  const managers: RepositoryMonitoringManager[] = [];

  const makeManager = (
    overrides: Partial<
      ConstructorParameters<typeof RepositoryMonitoringManager>[0]
    > = {},
  ) => {
    const manager = new RepositoryMonitoringManager({
      autoStart: false,
      logLevel: 'error',
      spawnedBy: 'desktop',
      homeDir: home,
      socketPath,
      nodeBinary: process.execPath,
      daemonEntryPath: DAEMON_BUNDLE,
      daemonEnv: { REPO_MONITOR_IDLE_EXIT_MS: '0' },
      ...overrides,
    });
    managers.push(manager);
    return manager;
  };

  const killDaemon = async () => {
    const hello = await probeDaemon(socketPath);
    if (!hello) return;
    try {
      process.kill(hello.pid, 'SIGTERM');
    } catch {
      return;
    }
    for (let i = 0; i < 50 && (await probeDaemon(socketPath)); i++)
      await sleep(100);
  };

  beforeEach(() => {
    mockSentToWindows.length = 0;
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'rmm-home-'));
    // macOS caps sun_path at 104 bytes; keep the socket out of the long temp home.
    socketPath = path.join(
      os.tmpdir(),
      `rmm-${process.pid}-${Date.now().toString(36)}.sock`,
    );
    repo = makeRepo(home);
  });

  afterEach(async () => {
    for (const m of managers.splice(0)) m.stop();
    await killDaemon();
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(socketPath, { force: true });
  });

  it('start() spawns the daemon, reports connected and exposes daemon info', async () => {
    const manager = makeManager();
    const phases: string[] = [];
    manager.on('lifecycle', (e: { phase: string }) => phases.push(e.phase));
    const ready = new Promise<void>((resolve) =>
      manager.once('ready', resolve),
    );

    await manager.start();
    await ready;

    expect(phases).toEqual(['connecting', 'connected']);
    expect(manager.getStatus()).toEqual({
      connected: true,
      reconnectAttempts: 0,
    });

    const info = manager.getDaemonInfo();
    expect(info).not.toBeNull();
    expect(info?.owner).toBe('desktop');
    expect(info?.spawnedBy).toBe('desktop');
    expect(info?.nodeVersion).toBe(process.version);
    expect(info?.socketPath).toBe(socketPath);
    expect(info?.version).toBe(info?.bundledVersion);
    expect(info?.updateAvailable).toBe(false);

    const diagnostics = manager.getDiagnostics();
    expect(diagnostics.phase).toBe('connected');
    expect(diagnostics.connected).toBe(true);
    expect(diagnostics.daemonPid).toBe(info?.pid);
    expect(diagnostics.lastConnectedAt).not.toBeNull();
    expect(
      diagnostics.watcherImpl === 'parcel' ||
        diagnostics.watcherImpl === 'chokidar',
    ).toBe(true);
    expect(diagnostics.daemon).toEqual(info);
  }, 30_000);

  it('serves typed requests and forwards daemon events to listeners and windows', async () => {
    const manager = makeManager();
    await manager.start();

    const cacheSync = new Promise<unknown>((resolve) =>
      manager.once('cache-sync', resolve),
    );
    await manager.registerRepository(repo);
    const tree = await manager.getFileTree(repo);
    expect(tree?.allFiles.map((f) => f.path)).toContain('src/a.ts');

    await cacheSync;
    expect(
      mockSentToWindows.some(
        (m) => m.channel === 'repository-monitoring:cache-sync',
      ),
    ).toBe(true);

    const status = await manager.getMonitoringStatus();
    expect(status.repositories.map((r) => r.path)).toContain(repo);
    expect(status.daemon?.clients).toBe(1);
    expect(status.daemon?.nodeVersion).toBe(process.version);
    // CPU is a share of one core since the last poll, not cumulative ms.
    expect(status.currentMemory).toBe(status.daemon?.memoryBytes);
    expect(status.currentCpu).toBeGreaterThanOrEqual(0);
    expect(status.currentCpu).toBeLessThanOrEqual(100 * os.cpus().length);
    const again = await manager.getMonitoringStatus();
    expect(again.currentCpu).toBeLessThanOrEqual(100 * os.cpus().length);

    const daemon = await manager.getDaemonDiagnostics();
    expect(daemon.state).toBe('running');
    if (daemon.state !== 'running') return;
    const entry = daemon.repos.find((r) => r.path === repo);
    expect(entry?.slices.fileTree?.updatedAt).toEqual(expect.any(Number));
  }, 30_000);

  it('a second manager joins the same daemon instead of spawning another', async () => {
    const first = makeManager({ spawnedBy: 'desktop' });
    await first.start();
    const second = makeManager({ spawnedBy: 'studio' });
    await second.start();

    expect(second.getDaemonInfo()?.pid).toBe(first.getDaemonInfo()?.pid);
    expect(second.getDaemonInfo()?.owner).toBe('desktop');
    const status = await second.getMonitoringStatus();
    expect(status.daemon?.clients).toBe(2);
  }, 30_000);

  it('stop() disconnects without killing the shared daemon', async () => {
    const manager = makeManager();
    await manager.start();
    const pid = manager.getDaemonInfo()?.pid;

    const disconnected = new Promise<void>((resolve) =>
      manager.once('disconnected', () => resolve()),
    );
    manager.stop();
    await disconnected;

    expect(manager.getStatus().connected).toBe(false);
    expect(manager.getDiagnostics().phase).toBe('disconnected');
    expect(manager.getDiagnostics().lastDisconnect?.reason).toBeDefined();
    expect((await probeDaemon(socketPath))?.pid).toBe(pid);
  }, 30_000);

  it('reconnects and replays registrations when the daemon dies', async () => {
    const manager = makeManager();
    await manager.start();
    await manager.registerRepository(repo);
    const oldPid = manager.getDaemonInfo()?.pid;
    expect(oldPid).toBeDefined();

    const reconnected = new Promise<void>((resolve) =>
      manager.once('ready', resolve),
    );
    process.kill(oldPid as number, 'SIGKILL');
    await reconnected;

    expect(manager.getDaemonInfo()?.pid).not.toBe(oldPid);
    expect(
      manager.getDiagnostics().lifecycleHistory.map((e) => e.phase),
    ).toEqual(expect.arrayContaining(['reconnecting', 'connected']));
    const status = await manager.getMonitoringStatus();
    expect(status.repositories.map((r) => r.path)).toContain(repo);
  }, 40_000);

  it('restartDaemon() replaces the daemon and applies the requested watcher impl', async () => {
    const manager = makeManager();
    await manager.start();
    const oldPid = manager.getDaemonInfo()?.pid;

    expect(manager.setWatcherImpl('chokidar')).toBe(true);
    expect(manager.setWatcherImpl('chokidar')).toBe(false);
    await manager.restartDaemon();

    expect(manager.getDaemonInfo()?.pid).not.toBe(oldPid);
    expect(manager.getDiagnostics().watcherImpl).toBe('chokidar');
    expect(manager.getDiagnostics().requestedWatcherImpl).toBe('chokidar');
  }, 40_000);

  it('start() throws when spawning is impossible', async () => {
    const manager = makeManager({ nodeBinary: '/nonexistent/node' });
    await expect(manager.start()).rejects.toThrow(
      /could not start repository monitor daemon/,
    );
    expect(manager.getDiagnostics().phase).toBe('unreachable');
    expect(manager.getStatus().connected).toBe(false);
    expect(manager.getDiagnostics().lastError?.message).toMatch(/nonexistent/);
  }, 30_000);

  it('getLogTail() reads the daemon log', async () => {
    const manager = makeManager();
    await manager.start();
    const tail = await manager.getLogTail({ daemonLines: 50 });
    expect(tail.daemonLog.path).toBe(manager.getDaemonLogPath());
    expect(tail.daemonLog.path).toBe(manager.getLogPaths().daemonLog);
    expect(tail.daemonLog.content).toMatch(/ready pid=/);
  }, 30_000);
});
