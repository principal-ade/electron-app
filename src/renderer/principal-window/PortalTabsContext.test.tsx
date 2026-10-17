/// <reference types="jest" />
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { PortalTabsProvider, useWorkspaceTabs } from './PortalTabsContext';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { useBridgeBrowserOpen } from '../hooks/useBridgeBrowserOpen';
import { BrowserService } from '../services/BrowserService';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { OpenBrowserEnvelope } from '../../shared/main-process-api-interfaces/BrowserAPI';

jest.mock('../main-process-api/ProcessRegistryService', () => ({
  ProcessRegistryService: {
    list: jest.fn(),
    onChanged: jest.fn(),
    stop: jest.fn(),
    restart: jest.fn(),
  },
}));
jest.mock('../services/BrowserService', () => ({
  BrowserService: { onOpenBrowser: jest.fn(), acknowledgeOpen: jest.fn() },
}));

const server: ProcessEntry = {
  id: 'server-1',
  label: 'Vite',
  command: 'npm run dev',
  cwd: '/repo',
  origin: 'managed',
  kind: 'dev-server',
  status: 'running',
  port: 5173,
  startedAt: 1,
  runCount: 1,
};
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PortalTabsProvider>{children}</PortalTabsProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  (ProcessRegistryService.list as jest.Mock).mockResolvedValue([server]);
  (ProcessRegistryService.onChanged as jest.Mock).mockReturnValue(jest.fn());
});

test('linked tabs stay synchronized outside Processes view and closing never stops the process', async () => {
  let changed!: (entries: ProcessEntry[]) => void;
  (ProcessRegistryService.onChanged as jest.Mock).mockImplementation(
    (callback) => {
      changed = callback;
      return jest.fn();
    },
  );
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  await act(async () => {
    result.current.openLocalhostBrowser(5173, '/docs', 'Vite', server.id);
  });
  act(() => changed([{ ...server, port: 6006, runCount: 2 }]));
  expect(result.current.tabs[0]).toMatchObject({
    port: 6006,
    processReady: true,
  });
  act(() => changed([{ ...server, status: 'stopped' }]));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.tabs[0]).toMatchObject({
    processStatus: 'stopped',
    processReady: false,
  });
  act(() => result.current.setTabs([]));
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  expect(ProcessRegistryService.restart).not.toHaveBeenCalled();
});

test('a late initial snapshot does not overwrite newer process events', async () => {
  let changed!: (entries: ProcessEntry[]) => void;
  let resolveList!: (entries: ProcessEntry[]) => void;
  (ProcessRegistryService.list as jest.Mock).mockReturnValue(
    new Promise((resolve) => {
      resolveList = resolve;
    }),
  );
  (ProcessRegistryService.onChanged as jest.Mock).mockImplementation(
    (callback) => {
      changed = callback;
      return jest.fn();
    },
  );
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  act(() => {
    result.current.openLocalhostBrowser(5173, '/', undefined, server.id);
  });
  act(() => changed([{ ...server, port: 6006 }]));
  await act(async () => resolveList([server]));
  expect(result.current.tabs[0]).toMatchObject({ port: 6006 });
});

test('a second linked process gets an initial status without waiting for an event', async () => {
  const second = { ...server, id: 'server-2', port: 6006 };
  (ProcessRegistryService.list as jest.Mock).mockResolvedValue([
    server,
    second,
  ]);
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  await act(async () => {
    result.current.openLocalhostBrowser(5173, '/', undefined, server.id);
  });
  await act(async () => {
    result.current.openLocalhostBrowser(6006, '/', undefined, second.id);
  });
  expect(result.current.tabs[1]).toMatchObject({
    processId: second.id,
    processReady: true,
  });
});

test('bridge opens reveal the workspace and acknowledge committed tab identity', async () => {
  let open!: (envelope: OpenBrowserEnvelope) => void;
  const unsubscribe = jest.fn();
  (BrowserService.onOpenBrowser as jest.Mock).mockImplementation((callback) => {
    open = callback;
    return unsubscribe;
  });
  const reveal = jest.fn();
  const { result, unmount } = renderHook(
    () => {
      useBridgeBrowserOpen(reveal);
      return useWorkspaceTabs();
    },
    { wrapper },
  );
  await act(async () =>
    open({ requestId: 'request-1', port: 5173, path: '/docs' }),
  );
  expect(reveal).toHaveBeenCalledTimes(1);
  expect(result.current.tabs[0]).toMatchObject({ path: '/docs' });
  expect(BrowserService.acknowledgeOpen).toHaveBeenCalledWith(
    'request-1',
    result.current.tabs[0].id,
  );
  expect(ProcessRegistryService.stop).not.toHaveBeenCalled();
  unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
