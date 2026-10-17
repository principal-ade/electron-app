import type { LocalhostBrowserTarget } from '../../shared/main-process-api-interfaces/BrowserAPI';
import type { ProcessEntry } from '../../shared/main-process-api-interfaces/ProcessRegistryAPI';
import type { LocalhostBrowserTab } from '../events/portalTabs';
import type { WorkspaceTab } from './PortalTabsContext';

export function browserTabId(
  target: Pick<LocalhostBrowserTarget, 'port' | 'processId'>,
): string {
  return target.processId
    ? `localhost-browser-process-${target.processId}`
    : `localhost-browser-${target.port}`;
}

export function openOrNavigateLocalhostBrowser(
  tabs: WorkspaceTab[],
  target: LocalhostBrowserTarget,
): WorkspaceTab[] {
  const id = browserTabId(target);
  const existing = tabs.find((tab) => tab.id === id) as
    | LocalhostBrowserTab
    | undefined;
  const next: LocalhostBrowserTab = {
    ...existing,
    id,
    label: target.label || existing?.label || `localhost:${target.port}`,
    contentType: 'localhost-browser',
    closable: true,
    port: target.port,
    path: target.path,
    processId: target.processId,
    navigationRevision: (existing?.navigationRevision ?? 0) + 1,
  };
  return existing
    ? tabs.map((tab) => (tab.id === id ? next : tab))
    : [...tabs, next];
}

/** Never focus, close, start, or stop anything when process state changes. */
export function syncBrowserProcesses(
  tabs: WorkspaceTab[],
  processes: ProcessEntry[],
): WorkspaceTab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.contentType !== 'localhost-browser' || !tab.processId) return tab;
    const entry = processes.find((p) => p.id === tab.processId);
    const port = entry?.port ?? tab.port;
    const processStatus = entry?.status ?? 'removed';
    const processReady = entry?.status === 'running' && entry.port != null;
    const processRunCount = entry?.runCount;
    if (
      port === tab.port &&
      processStatus === tab.processStatus &&
      processReady === tab.processReady &&
      processRunCount === tab.processRunCount
    )
      return tab;
    changed = true;
    return {
      ...tab,
      port,
      processStatus,
      processReady,
      processRunCount,
    } as LocalhostBrowserTab;
  });
  return changed ? next : tabs;
}
