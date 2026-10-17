import { useEffect, useState } from 'react';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { BrowserService } from '../services/BrowserService';

export function useBridgeBrowserOpen(revealWorkspace: () => void): void {
  const { tabs, openLocalhostBrowser } = useWorkspaceTabs();
  const [pending, setPending] = useState<
    { requestId: string; tabId: string }[]
  >([]);

  useEffect(
    () =>
      BrowserService.onOpenBrowser(
        ({ requestId, port, path, label, processId }) => {
          revealWorkspace();
          const tabId = openLocalhostBrowser(port, path, label, processId);
          setPending((prev) => [...prev, { requestId, tabId }]);
        },
      ),
    [openLocalhostBrowser, revealWorkspace],
  );

  useEffect(() => {
    if (!pending.length) return;
    const committed = pending.filter((p) =>
      tabs.some((tab) => tab.id === p.tabId),
    );
    if (!committed.length) return;
    committed.forEach(({ requestId, tabId }) =>
      BrowserService.acknowledgeOpen(requestId, tabId),
    );
    setPending((prev) => prev.filter((p) => !committed.includes(p)));
  }, [pending, tabs]);
}
