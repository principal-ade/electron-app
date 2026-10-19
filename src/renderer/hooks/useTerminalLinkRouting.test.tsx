import { act, renderHook, waitFor } from '@testing-library/react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { UserPreferences } from '../../shared/types/userPreferences.types';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { ShellService } from '../main-process-api/ShellService';
import { BrowserService } from '../services/BrowserService';
import { useTerminalLinkRouting } from './useTerminalLinkRouting';
import { useTerminalLinkHandler } from './useTerminalLinkHandler';

jest.mock('../main-process-api/UserPreferencesService');
jest.mock('../main-process-api/ShellService');
jest.mock('../services/BrowserService');

let updatePreferences: (preferences: UserPreferences) => void;
const unsubscribe = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({});
  (UserPreferencesService.onPreferencesUpdated as jest.Mock).mockImplementation(
    (callback) => {
      updatePreferences = callback;
      return unsubscribe;
    },
  );
  (BrowserService.openLocalhostUrl as jest.Mock).mockResolvedValue(true);
  (ShellService.openExternal as jest.Mock).mockResolvedValue({ success: true });
});

async function routing(enabled?: boolean) {
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({
    openLocalhostTerminalLinksInApp: enabled,
  });
  const hook = renderHook(() => useTerminalLinkRouting());
  await act(async () => {});
  return hook;
}

test.each([undefined, false])(
  'defaults to external opening when the setting is %p',
  async (enabled) => {
    const { result } = await routing(enabled);
    act(() => result.current('http://localhost:5173/'));
    await waitFor(() =>
      expect(ShellService.openExternal).toHaveBeenCalledWith(
        'http://localhost:5173/',
      ),
    );
    expect(BrowserService.openLocalhostUrl).not.toHaveBeenCalled();
  },
);

test.each([
  'http://localhost:5173/docs?q=1#intro',
  'http://localhost:80/',
  'HTTP://LOCALHOST:5173/',
])('routes supported localhost links to app tabs: %s', async (url) => {
  const { result } = await routing(true);
  act(() => result.current(url));
  await waitFor(() =>
    expect(BrowserService.openLocalhostUrl).toHaveBeenCalledWith(url),
  );
  expect(ShellService.openExternal).not.toHaveBeenCalled();
});

test.each([
  'https://example.com/docs',
  'https://localhost:5173/',
  'http://localhost/',
  'http://127.0.0.1:5173/',
  'http://[::1]:5173/',
  'http://localhost.evil:5173/',
  'http://user@localhost:5173/',
  'http://localhost:65536/',
  'http://localhost:5173/\\evil',
  'mailto:hello@example.com',
])('leaves unsupported links external: %s', async (url) => {
  const { result } = await routing(true);
  act(() => result.current(url));
  await waitFor(() =>
    expect(ShellService.openExternal).toHaveBeenCalledWith(url),
  );
  expect(BrowserService.openLocalhostUrl).not.toHaveBeenCalled();
});

test('ignores empty links', async () => {
  const { result } = await routing(true);
  act(() => result.current(''));
  expect(BrowserService.openLocalhostUrl).not.toHaveBeenCalled();
  expect(ShellService.openExternal).not.toHaveBeenCalled();
});

test.each(['unavailable', 'rejected'])(
  'falls back to external opening when app navigation is %s',
  async (failure) => {
    if (failure === 'unavailable') {
      (BrowserService.openLocalhostUrl as jest.Mock).mockResolvedValue(false);
    } else {
      (BrowserService.openLocalhostUrl as jest.Mock).mockRejectedValue(
        new Error('IPC unavailable'),
      );
    }
    const { result } = await routing(true);
    act(() => result.current('http://localhost:5173/docs?x=1#top'));
    await waitFor(() =>
      expect(ShellService.openExternal).toHaveBeenCalledWith(
        'http://localhost:5173/docs?x=1#top',
      ),
    );
  },
);

test('applies preference changes to the existing callback and cleans up on unmount', async () => {
  const { result, unmount } = await routing(false);
  const click = result.current;
  act(() => updatePreferences({ openLocalhostTerminalLinksInApp: true }));
  act(() => click('http://localhost:5173/'));
  await waitFor(() =>
    expect(BrowserService.openLocalhostUrl).toHaveBeenCalledTimes(1),
  );
  act(() => updatePreferences({ openLocalhostTerminalLinksInApp: false }));
  act(() => click('http://localhost:5173/'));
  await waitFor(() =>
    expect(ShellService.openExternal).toHaveBeenCalledTimes(1),
  );
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('does not overwrite a live update with an older initial preference read', async () => {
  let resolvePreferences!: (preferences: UserPreferences) => void;
  (UserPreferencesService.getPreferences as jest.Mock).mockReturnValue(
    new Promise<UserPreferences>((resolve) => {
      resolvePreferences = resolve;
    }),
  );
  const { result } = renderHook(() => useTerminalLinkRouting());
  act(() => updatePreferences({ openLocalhostTerminalLinksInApp: true }));
  await act(async () =>
    resolvePreferences({ openLocalhostTerminalLinksInApp: false }),
  );
  act(() => result.current('http://localhost:5173/'));
  await waitFor(() =>
    expect(BrowserService.openLocalhostUrl).toHaveBeenCalledTimes(1),
  );
  expect(ShellService.openExternal).not.toHaveBeenCalled();
});

test('routes panel-bus clicks through the same policy and removes the listener', async () => {
  (UserPreferencesService.getPreferences as jest.Mock).mockResolvedValue({
    openLocalhostTerminalLinksInApp: true,
  });
  const events = { on: jest.fn(), off: jest.fn() };
  const { unmount } = renderHook(() =>
    useTerminalLinkHandler(events as unknown as PanelEventEmitter),
  );
  await act(async () => {});
  const [eventName, listener] = events.on.mock.calls[0];
  expect(eventName).toBe('terminal:link-click');
  act(() => listener({ payload: { url: 'http://localhost:5173/' } }));
  await waitFor(() =>
    expect(BrowserService.openLocalhostUrl).toHaveBeenCalledWith(
      'http://localhost:5173/',
    ),
  );
  unmount();
  expect(events.off).toHaveBeenCalledWith(eventName, listener);
});
