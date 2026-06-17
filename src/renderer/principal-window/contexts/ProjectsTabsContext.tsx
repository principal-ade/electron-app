/**
 * ProjectsTabsContext
 *
 * Owns the Projects view's tab state ABOVE IntegratedShell's conditional
 * `{activeView === 'projects' && <ProjectsView />}` mount. This means:
 *
 *  - Tabs survive when the user toggles away from the Projects view and back.
 *  - The titlebar (which lives outside ProjectsView) can open tabs directly,
 *    without relying on a transient event landing on a mounted listener —
 *    fixing the bug where picking a repo from the titlebar while the Projects
 *    view was hidden dropped the `repository:selected` event into the
 *    void.
 *
 * ProjectsPanelFramework reads `tabs` / `activeTabId` from here in place of
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
  LocalTrailTab,
  MarkdownDocTab,
  ProjectInfoTab,
  SharedTrailTab,
  UserProfileTab,
} from '../../projects-view/ProjectsPanelFramework';
import type { RepositorySelectedPayload } from '../../events/repositorySelected';

const INITIAL_TABS: FeedTab[] = [
  {
    id: 'activity-feed',
    contentType: 'activity-feed',
    label: 'Recent Activity',
  } as ActivityFeedTab,
];

const INITIAL_ACTIVE_TAB_ID = 'activity-feed';

interface ProjectsTabsContextValue {
  tabs: FeedTab[];
  setTabs: React.Dispatch<React.SetStateAction<FeedTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Open a `project-info-<purl>` tab idempotently and focus it. */
  openProjectInfo: (payload: RepositorySelectedPayload) => void;
  /** Open a `user-profile-<username>` tab idempotently and focus it. */
  openUserProfile: (username: string, email?: string) => void;
  /** Open a `shared-trail-<trailId>` tab idempotently and focus it. */
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
  /** Open a `local-trail-<trailId>` tab idempotently and focus it. */
  openLocalTrail: (trailId: string, title?: string) => void;
  /** Open a `markdown-doc-<filePath>` tab idempotently and focus it. */
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
}

const ProjectsTabsContext = createContext<ProjectsTabsContextValue | null>(null);

export const ProjectsTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tabs, setTabs] = useState<FeedTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    INITIAL_ACTIVE_TAB_ID,
  );

  const openProjectInfo = useCallback(
    (payload: RepositorySelectedPayload) => {
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

  const value = useMemo<ProjectsTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openProjectInfo,
      openUserProfile,
      openSharedTrail,
      openLocalTrail,
      openMarkdownDoc,
    }),
    [
      tabs,
      activeTabId,
      openProjectInfo,
      openUserProfile,
      openSharedTrail,
      openLocalTrail,
      openMarkdownDoc,
    ],
  );

  return (
    <ProjectsTabsContext.Provider value={value}>
      {children}
    </ProjectsTabsContext.Provider>
  );
};

export function useProjectsTabs(): ProjectsTabsContextValue {
  const ctx = useContext(ProjectsTabsContext);
  if (!ctx) {
    throw new Error('useProjectsTabs must be used within ProjectsTabsProvider');
  }
  return ctx;
}
