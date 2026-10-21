import { useEffect, useState } from 'react';
import { useWorkspaceTabs } from '../principal-window/PortalTabsContext';
import { BrunoService } from '../main-process-api/BrunoService';

/** Opening only installs a definition. No send action is invoked here. */
export function useBridgeRequestOpen(revealWorkspace: () => void): void {
  const { tabs, openHttpRequest, refreshSavedRequests } = useWorkspaceTabs();
  const [pending, setPending] = useState<
    { requestId: string; tabId: string }[]
  >([]);
  useEffect(
    () =>
      BrunoService.onOpenRequest(({ requestId, ...request }) => {
        revealWorkspace();
        const tabId = openHttpRequest(request);
        void refreshSavedRequests();
        setPending((previous) => [...previous, { requestId, tabId }]);
      }),
    [openHttpRequest, revealWorkspace, refreshSavedRequests],
  );

  useEffect(() => {
    const committed = pending.filter((entry) =>
      tabs.some((tab) => tab.id === entry.tabId),
    );
    if (!committed.length) return;
    committed.forEach(({ requestId, tabId }) =>
      BrunoService.acknowledgeOpen(requestId, tabId),
    );
    setPending((previous) =>
      previous.filter((entry) => !committed.includes(entry)),
    );
  }, [pending, tabs]);
}
