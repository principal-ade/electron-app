/** @jest-environment node */
jest.mock('electron', () => ({
  BrowserWindow: {
    fromId: jest.fn(),
    getAllWindows: () => [],
  },
}));
jest.mock('./sessionManagerSingleton', () => ({
  getSessionManagerInstance: jest.fn(),
}));
jest.mock('./TerminalOwnershipManager', () => ({
  ownershipManager: { claimOwnership: jest.fn(() => ({})) },
}));
jest.mock('./utils/ptyLoader', () => ({ isPtyAvailable: () => true }));
jest.mock('../stores/AlexandriaRegistryService', () => ({
  AlexandriaRegistryService: {
    getInstance: () => ({
      getRepositoryByPath: async () => null,
      updateLastOpened: async () => {},
    }),
  },
}));
jest.mock('../../shared/telemetry/traceparent', () => ({
  traceparentFromSpan: () => undefined,
}));
jest.mock('../telemetry', () => ({
  getTracer: () => ({
    startSpan: () => ({
      setAttribute: jest.fn(),
      setStatus: jest.fn(),
      addEvent: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    }),
  }),
}));

import { BrowserWindow } from 'electron';
import { getSessionManagerInstance } from './sessionManagerSingleton';
import { createTerminalSession } from './terminalSessionService';

describe('createTerminalSession env overlay', () => {
  const window = { id: 7, isDestroyed: () => false };
  let manager: {
    createSession: jest.Mock;
    canCreateSession: jest.Mock;
    getAllSessions: jest.Mock;
    getMaxSessions: jest.Mock;
    createMessageChannelForSession: jest.Mock;
  };

  beforeEach(() => {
    jest.mocked(BrowserWindow.fromId).mockReturnValue(window as never);
    manager = {
      createSession: jest.fn(async () => 'session-1'),
      canCreateSession: jest.fn(() => true),
      getAllSessions: jest.fn(() => new Map()),
      getMaxSessions: jest.fn(() => 20),
      createMessageChannelForSession: jest.fn(),
    };
    jest.mocked(getSessionManagerInstance).mockReturnValue(manager as never);
  });

  test('passes the overlay through to the session manager', async () => {
    const overlay = { NODE_AUTH_TOKEN: 'secret' };
    const result = await createTerminalSession(
      { cwd: '/repo', command: 'npm run build', env: overlay },
      7,
      'http',
    );
    expect(result).toEqual({ sessionId: 'session-1', reused: false });
    expect(manager.createSession).toHaveBeenCalledWith(
      '/repo',
      undefined,
      'npm run build',
      undefined,
      undefined,
      overlay,
    );
  });

  test('normal terminals pass no overlay', async () => {
    await createTerminalSession({ cwd: '/repo' }, 7, 'renderer');
    expect(manager.createSession).toHaveBeenCalledWith(
      '/repo',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  });
});
