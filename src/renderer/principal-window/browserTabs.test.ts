import {
  browserTabId,
  openOrNavigateLocalhostBrowser,
  syncBrowserProcesses,
} from './browserTabs';
import type { LocalhostBrowserTab } from '../events/portalTabs';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';

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
const target = { port: 5173, path: '/docs', processId: server.id };

test('uses managed identity or origin, never a PID', () => {
  expect(browserTabId(target)).toBe('localhost-browser-process-server-1');
  expect(browserTabId({ port: 5173 })).toBe('localhost-browser-5173');
});

test('reopening navigates one tab, including an identical URL', () => {
  const once = openOrNavigateLocalhostBrowser([], target);
  const twice = openOrNavigateLocalhostBrowser(once, {
    ...target,
    path: '/other?q=1#top',
  });
  expect(twice).toHaveLength(1);
  expect(twice[0]).toMatchObject({
    id: once[0].id,
    path: '/other?q=1#top',
    navigationRevision: 2,
  });
  expect(openOrNavigateLocalhostBrowser(twice, target)[0]).toMatchObject({
    navigationRevision: 3,
  });
});

test('linked tabs follow new ports without changing identity or path', () => {
  const tabs = openOrNavigateLocalhostBrowser([], target);
  const synced = syncBrowserProcesses(tabs, [
    { ...server, port: 6006, runCount: 2 },
  ]);
  expect(synced[0]).toMatchObject({
    id: tabs[0].id,
    path: '/docs',
    port: 6006,
    processStatus: 'running',
    processReady: true,
    processRunCount: 2,
  });
  expect(
    syncBrowserProcesses(synced, [{ ...server, port: 6006, runCount: 2 }]),
  ).toBe(synced);
});

test('stopping, restarting and removing a server keep the tab unavailable', () => {
  const tabs = openOrNavigateLocalhostBrowser([], target);
  for (const status of [
    'stopped',
    'failed',
    'restarting',
    'stopping',
  ] as const) {
    expect(
      syncBrowserProcesses(tabs, [{ ...server, status }])[0],
    ).toMatchObject({
      id: tabs[0].id,
      processStatus: status,
      processReady: false,
    });
  }
  expect(
    syncBrowserProcesses(tabs, [{ ...server, port: undefined }])[0],
  ).toMatchObject({ processReady: false });
  expect(syncBrowserProcesses(tabs, [])[0]).toMatchObject({
    id: tabs[0].id,
    processStatus: 'removed',
    processReady: false,
  });
});

test('unassociated URL tabs do not follow unrelated processes on the same port', () => {
  const tabs = openOrNavigateLocalhostBrowser([], { port: 5173, path: '/' });
  expect(syncBrowserProcesses(tabs, [server])).toBe(tabs);
});

test('same managed process opened at a new port reuses its tab', () => {
  const tabs = openOrNavigateLocalhostBrowser([], target);
  const reopened = openOrNavigateLocalhostBrowser(tabs, {
    ...target,
    port: 6006,
  });
  expect(reopened).toHaveLength(1);
  expect((reopened[0] as LocalhostBrowserTab).port).toBe(6006);
});
