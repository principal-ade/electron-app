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
  LocalTrailTab,
  MarkdownDocTab,
  SharedTrailTab,
  TopicTab,
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
  /** Open a `topic-<topicId>` tab idempotently and focus it. */
  openTopic: (topicId: string, title?: string) => void;
  /** Open a `local-trail-<trailId>` tab idempotently and focus it. */
  openLocalTrail: (trailId: string, title?: string) => void;
  /** Open a `markdown-doc-<filePath>` tab idempotently and focus it. */
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
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

  const openTopic = useCallback((topicId: string, title?: string) => {
    const tabId = `topic-${topicId}`;

    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const newTab: TopicTab = {
        id: tabId,
        label: title || 'Topic',
        contentType: 'topic',
        closable: true,
        topicId,
      };
      return [...prev, newTab];
    });
    setActiveTabId(tabId);
  }, []);

  const openLocalTrail = useCallback((trailId: string, title?: string) => {
    const tabId = `local-trail-${trailId}`;

    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const newTab: LocalTrailTab = {
        id: tabId,
        label: title || 'Trail',
        contentType: 'local-trail',
        closable: true,
        trailId,
      };
      return [...prev, newTab];
    });
    setActiveTabId(tabId);
  }, []);

  const openMarkdownDoc = useCallback(
    (filePath: string, repositoryPath?: string) => {
      const tabId = `markdown-doc-${filePath}`;

      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) return prev;
        const newTab: MarkdownDocTab = {
          id: tabId,
          label: filePath.split('/').pop() || 'Document',
          contentType: 'markdown-doc',
          closable: true,
          filePath,
          repositoryPath,
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
      openTopic,
      openLocalTrail,
      openMarkdownDoc,
    }),
    [
      tabs,
      activeTabId,
      openSharedTrail,
      openTopic,
      openLocalTrail,
      openMarkdownDoc,
    ],
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
