import { act, renderHook, waitFor } from '@testing-library/react';
import type { ProgramStatusRecord } from '../../shared/terminal/programStatus';
import { onProgramStatus, terminalClient } from '../tipc/terminalClient';
import { useTerminalProgramStatusState } from './useTerminalProgramStatusState';

jest.mock('../tipc/terminalClient', () => ({
  onProgramStatus: jest.fn(),
  terminalClient: { getAllProgramStatus: jest.fn() },
}));

type Records = Record<string, ProgramStatusRecord[]>;
let update: (data: {
  sessionId: string;
  records: ProgramStatusRecord[];
}) => void;
let resolveSnapshot: (records: Records) => void;
const unsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(onProgramStatus).mockImplementation((callback) => {
    update = callback;
    return unsubscribe;
  });
  jest.mocked(terminalClient.getAllProgramStatus).mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveSnapshot = resolve;
      }),
  );
});

test('loads current statuses for a newly opened window', async () => {
  const { result } = renderHook(useTerminalProgramStatusState);
  const snapshot: Records = {
    existing: [{ state: 'blocked', kind: 'question' }],
  };
  await act(async () => {
    resolveSnapshot(snapshot);
  });
  expect(result.current).toEqual(snapshot);
  expect(onProgramStatus).toHaveBeenCalledTimes(1);
});

test('live updates and clears win over a late snapshot', async () => {
  const { result } = renderHook(useTerminalProgramStatusState);
  act(() => {
    update({ sessionId: 'live', records: [{ state: 'done' }] });
    update({ sessionId: 'cleared', records: [] });
  });
  await act(async () => {
    resolveSnapshot({
      live: [{ state: 'working' }],
      cleared: [{ state: 'blocked' }],
      unchanged: [{ state: 'error' }],
    });
  });
  expect(result.current).toEqual({
    live: [{ state: 'done' }],
    cleared: [],
    unchanged: [{ state: 'error' }],
  });
  act(() => update({ sessionId: 'live', records: [{ state: 'idle' }] }));
  expect(result.current.live).toEqual([{ state: 'idle' }]);
});

test('keeps receiving live status if the snapshot cannot be loaded', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest
    .mocked(terminalClient.getAllProgramStatus)
    .mockRejectedValueOnce(new Error('Unavailable'));
  try {
    const { result } = renderHook(useTerminalProgramStatusState);
    await waitFor(() => expect(warn).toHaveBeenCalled());
    act(() => update({ sessionId: 's1', records: [{ state: 'working' }] }));
    expect(result.current.s1).toEqual([{ state: 'working' }]);
  } finally {
    warn.mockRestore();
  }
});

test('unsubscribes and ignores a snapshot or broadcast after unmount', async () => {
  const { result, unmount } = renderHook(useTerminalProgramStatusState);
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  await act(async () => {
    update({ sessionId: 'late', records: [{ state: 'done' }] });
    resolveSnapshot({ late: [{ state: 'blocked' }] });
  });
  expect(result.current).toEqual({});
});
