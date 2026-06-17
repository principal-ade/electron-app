/**
 * TopicsTabsContext
 *
 * Owns the Topics view's tab state ABOVE IntegratedShell's conditional
 * `{activeView === 'topics' && <TopicsView />}` mount, mirroring
 * InboxTabsContext. Tabs survive when the user toggles away from the topics
 * view and back.
 *
 * TopicsPanelFramework reads `tabs` / `activeTabId` from here; TopicsLeftPanel
 * calls `openTopic` to surface a local topic's description as a tab.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type {
  TopicsTab,
  TopicsHomeTab,
  LocalTopicTab,
  LocalTrailTab,
} from '../../topics-view/TopicsPanelFramework';

const INITIAL_TABS: TopicsTab[] = [
  {
    id: 'topics-home',
    contentType: 'topics-home',
    label: 'Topics',
  } as TopicsHomeTab,
];

const INITIAL_ACTIVE_TAB_ID = 'topics-home';

interface TopicsTabsContextValue {
  tabs: TopicsTab[];
  setTabs: React.Dispatch<React.SetStateAction<TopicsTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Open a `local-topic-<topicId>` tab idempotently and focus it. */
  openTopic: (topicId: string, title?: string) => void;
  /** Open a `local-trail-<trailId>` tab idempotently and focus it. */
  openLocalTrail: (trailId: string, title?: string) => void;
}

const TopicsTabsContext = createContext<TopicsTabsContextValue | null>(null);

export const TopicsTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<TopicsTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    INITIAL_ACTIVE_TAB_ID,
  );

  const openTopic = useCallback((topicId: string, title?: string) => {
    const tabId = `local-topic-${topicId}`;

    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const newTab: LocalTopicTab = {
        id: tabId,
        label: title || 'Topic',
        contentType: 'local-topic',
        closable: true,
        topicId,
        title,
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

  const value = useMemo<TopicsTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openTopic,
      openLocalTrail,
    }),
    [tabs, activeTabId, openTopic, openLocalTrail],
  );

  return (
    <TopicsTabsContext.Provider value={value}>
      {children}
    </TopicsTabsContext.Provider>
  );
};

export function useTopicsTabs(): TopicsTabsContextValue {
  const ctx = useContext(TopicsTabsContext);
  if (!ctx) {
    throw new Error('useTopicsTabs must be used within TopicsTabsProvider');
  }
  return ctx;
}
