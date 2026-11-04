/** @jest-environment node */
jest.mock('electron', () => ({
  BrowserWindow: {
    fromId: jest.fn(),
    getAllWindows: () => [],
  },
}));
jest.mock('./TerminalOwnershipManager', () => ({
  ownershipManager: { claimOwnership: jest.fn() },
}));
jest.mock('../terminalEnvironment', () => ({}));
jest.mock('./daemonSpawner', () => ({}));
jest.mock('../stores/userPreferencesHandler', () => ({}));
jest.mock('../repository-monitoring/ipcHandlers', () => ({}));
jest.mock('../telemetry', () => ({ getTracer: () => ({}) }));

import { mergeEnvOverlay } from './TerminalSessionManager';

describe('mergeEnvOverlay', () => {
  test('overlay wins on conflict, base survives elsewhere', () => {
    expect(
      mergeEnvOverlay({ PATH: '/overlay/bin', NODE_AUTH_TOKEN: 'secret' }),
    ).toEqual({ PATH: '/overlay/bin', NODE_AUTH_TOKEN: 'secret' });
  });

  test('absent or non-object overlays merge nothing', () => {
    expect(mergeEnvOverlay(undefined)).toEqual({});
    expect(mergeEnvOverlay(null as unknown as Record<string, unknown>)).toEqual(
      {},
    );
  });

  test('drops non-string values instead of stringifying them into the PTY', () => {
    expect(
      mergeEnvOverlay({
        TOKEN: 'abc',
        NESTED: { nested: 'object-value' },
        EMPTY: '',
        COUNT: 3,
        UNSET: undefined,
      }),
    ).toEqual({ TOKEN: 'abc', EMPTY: '' });
  });
});
