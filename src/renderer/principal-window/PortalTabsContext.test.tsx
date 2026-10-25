/// <reference types="jest" />
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { PortalTabsProvider, useWorkspaceTabs } from './PortalTabsContext';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { useBridgeBrowserOpen } from '../hooks/useBridgeBrowserOpen';
import { BrowserService } from '../services/BrowserService';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { OpenBrowserEnvelope } from '../../shared/main-process-api-interfaces/BrowserAPI';
import { TopicService } from '../main-process-api/TopicService';
import {
  TopicEventType,
  type TopicChangeEvent,
} from '../../shared/main-process-api-interfaces/TopicAPI';

jest.mock('../main-process-api/TopicService', () => ({
  TopicService: { onTopicChange: jest.fn() },
}));

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
  (TopicService.onTopicChange as jest.Mock).mockReturnValue(jest.fn());
});

test('bridge ranges update an existing source tab, including repeated identical spans', () => {
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  const range = { startLineNumber: 302, startColumn: 1, endLineNumber: 304, endColumn: 2 };
  act(() => result.current.openSourceFile('/repo/code.ts', range));
  const firstId = result.current.tabs[0].id;
  act(() => result.current.openSourceFile('/repo/code.ts', range));
  expect(result.current.tabs).toHaveLength(1);
  expect(result.current.tabs[0]).toMatchObject({ id: firstId, range, rangeRevision: 2 });
  const next = { ...range, startLineNumber: 102, endLineNumber: 104 };
  act(() => result.current.openSourceFile('/repo/code.ts', next));
  expect(result.current.tabs[0]).toMatchObject({ range: next, rangeRevision: 3 });
  act(() => result.current.openSourceFile('/repo/code.ts'));
  expect(result.current.tabs[0]).toMatchObject({ range: next, rangeRevision: 3 });
  expect(result.current.activeTabId).toBe(firstId);
});

test('topic removal closes all matching tabs and selects a remaining tab', () => {
  let changed!: (event: TopicChangeEvent) => void;
  const unsubscribe = jest.fn();
  (TopicService.onTopicChange as jest.Mock).mockImplementation((callback) => {
    changed = callback;
    return unsubscribe;
  });
  const { result, unmount } = renderHook(useWorkspaceTabs, { wrapper });
  act(() => {
    result.current.openLocalTopic('topic-b', 'Keep');
    result.current.openLocalTopic('topic-a', 'Delete');
  });
  act(() =>
    result.current.setTabs((prev) => [
      ...prev,
      { ...prev[1], id: 'another-copy' },
    ]),
  );
  act(() => changed({ type: TopicEventType.REMOVED, id: 'topic-a' }));
  expect(result.current.tabs.map((tab) => tab.id)).toEqual([
    'local-topic-topic-b',
  ]);
  expect(result.current.activeTabId).toBe('local-topic-topic-b');
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('topic removal preserves unrelated active tabs and ignores other topic events', () => {
  let changed!: (event: TopicChangeEvent) => void;
  (TopicService.onTopicChange as jest.Mock).mockImplementation((callback) => {
    changed = callback;
    return jest.fn();
  });
  const { result } = renderHook(useWorkspaceTabs, { wrapper });
  act(() => {
    result.current.openLocalTopic('topic-a');
    result.current.openLocalTopic('topic-b');
  });
  act(() => changed({ type: TopicEventType.UPDATED, id: 'topic-a' }));
  expect(result.current.tabs).toHaveLength(2);
  act(() => changed({ type: TopicEventType.REMOVED, id: 'topic-a' }));
  expect(result.current.activeTabId).toBe('local-topic-topic-b');
  act(() => changed({ type: TopicEventType.REMOVED, id: 'topic-b' }));
  expect(result.current.tabs).toEqual([]);
  expect(result.current.activeTabId).toBeNull();
});

test('a removal broadcast closes the topic in every subscribed window', () => {
  const listeners = new Set<(event: TopicChangeEvent) => void>();
  (TopicService.onTopicChange as jest.Mock).mockImplementation((callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  });
  const first = renderHook(useWorkspaceTabs, { wrapper });
  const second = renderHook(useWorkspaceTabs, { wrapper });
  act(() => {
    first.result.current.openLocalTopic('topic-a');
    second.result.current.openLocalTopic('topic-a');
  });
  act(() => {
    for (const listener of listeners) {
      listener({ type: TopicEventType.REMOVED, id: 'topic-a' });
    }
  });
  expect(first.result.current.tabs).toEqual([]);
  expect(second.result.current.tabs).toEqual([]);
  first.unmount();
  second.unmount();
  expect(listeners.size).toBe(0);
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
