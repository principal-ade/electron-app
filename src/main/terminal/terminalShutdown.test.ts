jest.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
}));
jest.mock('./TerminalOwnershipManager', () => ({
  ownershipManager: { removeSession: jest.fn() },
}));
jest.mock('../terminalEnvironment', () => ({}));
jest.mock('./daemonSpawner', () => ({}));
jest.mock('../stores/userPreferencesHandler', () => ({}));
jest.mock('../repository-monitoring/ipcHandlers', () => ({}));
jest.mock('../telemetry', () => ({ getTracer: () => ({}) }));

import { TerminalSessionManager } from './TerminalSessionManager';
import type { TerminalSession } from './types';

describe('confirmed terminal shutdown', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function setup() {
    const manager = new TerminalSessionManager();
    manager.getAllSessions().set('session', {
      id: 'session',
      directory: '/clone',
    } as TerminalSession);
    // Keep the real shutdown path, but never start a PTY worker in a unit test.
    manager['sendToWorker'] = jest.fn();
    return manager;
  }

  it('does not resolve until the worker confirms process exit', async () => {
    const manager = setup();
    let finished = false;
    const closing = manager.destroySessionAndWaitForExit('session').then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(manager['sendToWorker']).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DESTROY_SESSION',
        sessionId: 'session',
      }),
    );
    manager['handleWorkerMessage']({
      type: 'SESSION_EXIT',
      id: 'exit',
      timestamp: Date.now(),
      sessionId: 'session',
      exitCode: 0,
    });
    await closing;
    expect(finished).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rejects on timeout rather than allowing files to be deleted', async () => {
    const manager = setup();
    const closing = manager.destroySessionAndWaitForExit('session');
    const rejected = expect(closing).rejects.toThrow(
      'Timed out closing terminal',
    );
    jest.advanceTimersByTime(15_000);
    await rejected;
    expect(manager.hasSession('session')).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores sessions that have already exited', async () => {
    const manager = setup();
    await manager.destroySessionAndWaitForExit('missing');
    expect(manager['sendToWorker']).not.toHaveBeenCalled();
  });
});
