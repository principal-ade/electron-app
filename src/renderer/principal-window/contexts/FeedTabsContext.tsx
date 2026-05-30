/**
 * FeedTabsContext
 *
 * Owns the Feed view's tab state ABOVE IntegratedShell's conditional
 * `{activeView === 'feed' && <FeedView />}` mount. This means:
 *
 *  - Tabs survive when the user toggles away from the feed view and back.
 *  - The titlebar (which lives outside FeedView) can open tabs directly,
 *    without relying on a transient event landing on a mounted listener —
 *    fixing the bug where picking a repo from the titlebar while the feed
 *    view was hidden dropped the `feed:repository-selected` event into the
 *    void.
 *
 * FeedPanelFramework reads `tabs` / `activeTabId` from here in place of
 * the local useState it used to own.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type {
  ActivityFeedTab,
  FeedTab,
  ProjectInfoTab,
  SharedTrailTab,
  UserProfileTab,
} from '../../feed-view/FeedPanelFramework';
import type { FeedRepositorySelectedPayload } from '../../events/feedRepositorySelected';

const INITIAL_TABS: FeedTab[] = [
  {
    id: 'activity-feed',
    contentType: 'activity-feed',
    label: 'Recent Activity',
  } as ActivityFeedTab,
];

const INITIAL_ACTIVE_TAB_ID = 'activity-feed';

interface FeedTabsContextValue {
  tabs: FeedTab[];
  setTabs: React.Dispatch<React.SetStateAction<FeedTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Open a `project-info-<purl>` tab idempotently and focus it. */
  openProjectInfo: (payload: FeedRepositorySelectedPayload) => void;
  /** Open a `user-profile-<username>` tab idempotently and focus it. */
  openUserProfile: (username: string, email?: string) => void;
  /** Open a `shared-trail-<trailId>` tab idempotently and focus it. */
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
}

const FeedTabsContext = createContext<FeedTabsContextValue | null>(null);

export const FeedTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<FeedTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    INITIAL_ACTIVE_TAB_ID,
  );

  const openProjectInfo = useCallback(
    (payload: FeedRepositorySelectedPayload) => {
      const { purl, github, localEntry } = payload;
      const tabId = `project-info-${purl}`;
      const label = github ? `${github.owner}/${github.name}` : String(purl);

      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) return prev;
        const newTab: ProjectInfoTab = {
          id: tabId,
          label,
          contentType: 'project-info',
          closable: true,
          purl,
          github,
          localEntry,
        };
        return [...prev, newTab];
      });
      setActiveTabId(tabId);
    },
    [],
  );

  const openUserProfile = useCallback((username: string, email?: string) => {
    const tabId = `user-profile-${username}`;

    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) return prev;
      const newTab: UserProfileTab = {
        id: tabId,
        label: `@${username}`,
        contentType: 'user-profile',
        closable: true,
        username,
        email,
      };
      return [...prev, newTab];
    });
    setActiveTabId(tabId);
  }, []);

  const openSharedTrail = useCallback(
    (trailId: string, owner?: string, repo?: string) => {
      const tabId = `shared-trail-${trailId}`;

      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) return prev;
        const newTab: SharedTrailTab = {
          id: tabId,
          label: 'Shared trail',
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

  const value = useMemo<FeedTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openProjectInfo,
      openUserProfile,
      openSharedTrail,
    }),
    [tabs, activeTabId, openProjectInfo, openUserProfile, openSharedTrail],
  );

  return (
    <FeedTabsContext.Provider value={value}>
      {children}
    </FeedTabsContext.Provider>
  );
};

export function useFeedTabs(): FeedTabsContextValue {
  const ctx = useContext(FeedTabsContext);
  if (!ctx) {
    throw new Error('useFeedTabs must be used within FeedTabsProvider');
  }
  return ctx;
}
