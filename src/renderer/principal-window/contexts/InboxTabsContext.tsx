/**
 * InboxTabsContext
 *
 * Owns the Inbox view's tab state ABOVE IntegratedShell's conditional
 * `{activeView === 'inbox' && <InboxView />}` mount, mirroring FeedTabsContext.
 * Tabs survive when the user toggles away from the inbox view and back.
 *
 * InboxPanelFramework reads `tabs` / `activeTabId` from here; InboxLeftPanel
 * calls `openSharedTrail` to surface a shared trail as a tab.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type {
  InboxTab,
  InboxHomeTab,
  SharedTrailTab,
} from '../../inbox-view/InboxPanelFramework';

const INITIAL_TABS: InboxTab[] = [
  {
    id: 'inbox-home',
    contentType: 'inbox-home',
    label: 'Inbox',
  } as InboxHomeTab,
];

const INITIAL_ACTIVE_TAB_ID = 'inbox-home';

interface InboxTabsContextValue {
  tabs: InboxTab[];
  setTabs: React.Dispatch<React.SetStateAction<InboxTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Open a `shared-trail-<trailId>` tab idempotently and focus it. */
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
}

const InboxTabsContext = createContext<InboxTabsContextValue | null>(null);

export const InboxTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<InboxTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    INITIAL_ACTIVE_TAB_ID,
  );

  const openSharedTrail = useCallback(
    (trailId: string, owner?: string, repo?: string) => {
      const tabId = `shared-trail-${trailId}`;

      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) return prev;
        const newTab: SharedTrailTab = {
          id: tabId,
          label: repo ? `${owner}/${repo}` : 'Shared trail',
          contentType: 'shared-trail',
          closable: true,
          trailId,
          owner,
          repo,
        };
        return [...prev, newTab];
      });
      setActiveTabId(tabId);
    },
    [],
  );

  const value = useMemo<InboxTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openSharedTrail,
    }),
    [tabs, activeTabId, openSharedTrail],
  );

  return (
    <InboxTabsContext.Provider value={value}>
      {children}
    </InboxTabsContext.Provider>
  );
};

export function useInboxTabs(): InboxTabsContextValue {
  const ctx = useContext(InboxTabsContext);
  if (!ctx) {
    throw new Error('useInboxTabs must be used within InboxTabsProvider');
  }
  return ctx;
}
