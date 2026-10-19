/** @jest-environment node */
import { EventEmitter } from 'events';
import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import type {
  RepositoryMonitoringManager,
  GitStatusWithFiles,
} from '@principal-ai/repository-monitoring-server';
import { HOME_REPOSITORY_REFRESH_INTEREST } from '../../shared/homeRepositoryRefresh';
import { registerHomeRepositoryRefreshHandlers } from './homeRepositoryRefreshHandlers';

jest.mock('electron', () => {
  const { EventEmitter } = require('events');
  return {
    app: new EventEmitter(),
    powerMonitor: new EventEmitter(),
    ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
    BrowserWindow: { fromWebContents: jest.fn() },
  };
});

function client(id: number) {
  const sender = Object.assign(new EventEmitter(), {
    id,
    isDestroyed: () => false,
  });
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: () => false,
    isVisible: jest.fn(() => true),
    isMinimized: jest.fn(() => false),
  });
  return { sender, window };
}

describe('Home refresh IPC lifecycle', () => {
  let refresh: jest.Mock;
  let manager: EventEmitter;
  let handler: (
    event: { sender: ReturnType<typeof client>['sender'] },
    interest: unknown,
  ) => GitStatusWithFiles[];
  let first: ReturnType<typeof client>;
  let second: ReturnType<typeof client>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    jest.clearAllMocks();
    first = client(1);
    second = client(2);
    jest
      .mocked(BrowserWindow.fromWebContents)
      .mockImplementation(
        (sender) =>
          (sender.id === 1
            ? first.window
            : second.window) as unknown as BrowserWindow,
      );
    refresh = jest.fn(async (repoPath) => ({ repoPath, ahead: 1 }));
    manager = Object.assign(new EventEmitter(), { refreshGitStatus: refresh });
    registerHomeRepositoryRefreshHandlers(
      manager as RepositoryMonitoringManager,
      jest.fn(),
    );
    handler = jest
      .mocked(ipcMain.handle)
      .mock.calls.find(
        ([channel]) => channel === HOME_REPOSITORY_REFRESH_INTEREST,
      )?.[1] as typeof handler;
  });
  afterEach(() => {
    app.emit('will-quit');
    jest.useRealTimers();
  });

  const interest = (visible = true, repoPaths = ['/a', '/b']) => ({
    consumerId: 'home',
    visible,
    repoPaths,
  });

  it('shares a queue across windows and removes crashed renderer interest', async () => {
    handler({ sender: first.sender }, interest());
    handler({ sender: second.sender }, interest());
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    first.sender.emit('render-process-gone');
    await jest.advanceTimersByTimeAsync(30_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    second.sender.emit('destroyed');
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('pauses minimized windows and resumes with a spaced queue', async () => {
    handler({ sender: first.sender }, interest());
    first.window.isMinimized.mockReturnValue(true);
    first.window.emit('minimize');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).not.toHaveBeenCalled();
    first.window.isMinimized.mockReturnValue(false);
    first.window.emit('restore');
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(29_999);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('releases navigating renderers and validates malformed requests', async () => {
    expect(() =>
      handler({ sender: first.sender }, { repoPaths: [42] }),
    ).toThrow('Invalid');
    handler({ sender: first.sender }, interest());
    first.sender.emit('did-navigate');
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('uses watcher events to defer checks, and pauses on suspend', async () => {
    handler({ sender: first.sender }, interest());
    manager.emit('git-status-changed', { repoPath: '/a', ahead: 2 });
    powerMonitor.emit('suspend');
    await jest.advanceTimersByTimeAsync(120_000);
    expect(refresh).not.toHaveBeenCalled();
    powerMonitor.emit('resume');
    await jest.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('/b');
  });
});
