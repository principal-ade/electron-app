/**
 * PortalTabsContext
 *
 * Owner of the workspace tab state. Portal-unification:
 *
 * - **Projects** keeps its own bucket (Increment 2b consolidated the provider;
 *   the Projects surface is folded into the shared host in a later step).
 * - **Inbox + Topics** now share ONE bucket (Increment 3, first cut): a single
 *   tab list + `activeTabId` hosted by the persistent `WorkspaceShell`, so
 *   switching the left panel between Inbox and Topics keeps your open tabs and a
 *   single terminal. `useWorkspaceTabs` is the shell's view of that bucket.
 *
 * The legacy per-surface compat hooks `useInboxTabs` / `useTopicsTabs` still
 * work — they read the shared workspace bucket and expose each surface's
 * `openTopic` (web-ade `topic` vs local `local-topic`). `useProjectsTabs` is
 * unchanged.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import type { TerminalTab } from '@industry-theme/xterm-terminal-panel';
import type {
  ActivityFeedTab,
  FeedTab,
  ProjectInfoTab,
  UserProfileTab,
  SharedTrailTab,
  LocalTrailTab,
  MarkdownDocTab,
  InboxHomeTab,
  TopicTab,
  TopicsHomeTab,
  LocalTopicTab,
} from '../events/portalTabs';
import type { RepositorySelectedPayload } from '../events/repositorySelected';

/**
 * The unified Inbox+Topics tab union hosted by `WorkspaceShell`. It is the
 * superset of the former `InboxTab` and `TopicsTab` unions (deduped — both
 * carried `TerminalTab` / `LocalTrailTab`).
 */
export type WorkspaceTab =
  | TerminalTab
  | InboxHomeTab
  | TopicsHomeTab
  | SharedTrailTab
  | TopicTab
  | LocalTopicTab
  | LocalTrailTab
  | MarkdownDocTab;

// ----------------------------------------------------------------------------
// Slice shapes
// ----------------------------------------------------------------------------

export interface ProjectsTabsContextValue {
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

/** The shared Inbox+Topics bucket, as the `WorkspaceShell` sees it. */
export interface WorkspaceTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Open a `shared-trail-<trailId>` tab (a web-ade trail). */
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
  /** Open a `topic-<topicId>` tab (a published web-ade topic). */
  openWebAdeTopic: (topicId: string, title?: string) => void;
  /** Open a `local-topic-<topicId>` tab (an on-disk topic). */
  openLocalTopic: (topicId: string, title?: string) => void;
  /** Open a `local-trail-<trailId>` tab. */
  openLocalTrail: (trailId: string, title?: string) => void;
  /** Open a `markdown-doc-<filePath>` tab. */
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
}

/** Back-compat shape for `useInboxTabs` (its `openTopic` = web-ade topic). */
export interface InboxTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
  openTopic: (topicId: string, title?: string) => void;
  openLocalTrail: (trailId: string, title?: string) => void;
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
}

/** Back-compat shape for `useTopicsTabs` (its `openTopic` = local topic). */
export interface TopicsTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openTopic: (topicId: string, title?: string) => void;
  openLocalTrail: (trailId: string, title?: string) => void;
}

const ProjectsTabsContext = createContext<ProjectsTabsContextValue | null>(null);
const WorkspaceTabsContext = createContext<WorkspaceTabsContextValue | null>(
  null,
);

// ----------------------------------------------------------------------------
// Projects slice (unchanged)
// ----------------------------------------------------------------------------

const PROJECTS_INITIAL_TABS: FeedTab[] = [
  {
    id: 'activity-feed',
    contentType: 'activity-feed',
    label: 'Recent Activity',
  } as ActivityFeedTab,
];

function useProjectsTabsValue(): ProjectsTabsContextValue {
  const [tabs, setTabs] = useState<FeedTab[]>(PROJECTS_INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    'activity-feed',
  );

  const openProjectInfo = useCallback((payload: RepositorySelectedPayload) => {
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
  }, []);

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

  return useMemo<ProjectsTabsContextValue>(
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
}

// ----------------------------------------------------------------------------
// Workspace slice (shared Inbox + Topics)
// ----------------------------------------------------------------------------

const WORKSPACE_INITIAL_TABS: WorkspaceTab[] = [
  { id: 'inbox-home', contentType: 'inbox-home', label: 'Inbox' } as InboxHomeTab,
  {
    id: 'topics-home',
    contentType: 'topics-home',
    label: 'Topics',
  } as TopicsHomeTab,
];

function useWorkspaceTabsValue(): WorkspaceTabsContextValue {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(WORKSPACE_INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>('inbox-home');

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

  const openWebAdeTopic = useCallback((topicId: string, title?: string) => {
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

  const openLocalTopic = useCallback((topicId: string, title?: string) => {
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

  return useMemo<WorkspaceTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openSharedTrail,
      openWebAdeTopic,
      openLocalTopic,
      openLocalTrail,
      openMarkdownDoc,
    }),
    [
      tabs,
      activeTabId,
      openSharedTrail,
      openWebAdeTopic,
      openLocalTopic,
      openLocalTrail,
      openMarkdownDoc,
    ],
  );
}

// ----------------------------------------------------------------------------
// Unified provider + hooks
// ----------------------------------------------------------------------------

export const PortalTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const projects = useProjectsTabsValue();
  const workspace = useWorkspaceTabsValue();

  return (
    <ProjectsTabsContext.Provider value={projects}>
      <WorkspaceTabsContext.Provider value={workspace}>
        {children}
      </WorkspaceTabsContext.Provider>
    </ProjectsTabsContext.Provider>
  );
};

export function useProjectsTabs(): ProjectsTabsContextValue {
  const ctx = useContext(ProjectsTabsContext);
  if (!ctx) {
    throw new Error('useProjectsTabs must be used within PortalTabsProvider');
  }
  return ctx;
}

export function useWorkspaceTabs(): WorkspaceTabsContextValue {
  const ctx = useContext(WorkspaceTabsContext);
  if (!ctx) {
    throw new Error('useWorkspaceTabs must be used within PortalTabsProvider');
  }
  return ctx;
}

/**
 * Back-compat: the Inbox surface's view of the shared workspace bucket. Its
 * `openTopic` opens a web-ade `topic` tab.
 */
export function useInboxTabs(): InboxTabsContextValue {
  const ws = useWorkspaceTabs();
  return useMemo(
    () => ({
      tabs: ws.tabs,
      setTabs: ws.setTabs,
      activeTabId: ws.activeTabId,
      setActiveTabId: ws.setActiveTabId,
      openSharedTrail: ws.openSharedTrail,
      openTopic: ws.openWebAdeTopic,
      openLocalTrail: ws.openLocalTrail,
      openMarkdownDoc: ws.openMarkdownDoc,
    }),
    [ws],
  );
}

/**
 * Back-compat: the Topics surface's view of the shared workspace bucket. Its
 * `openTopic` opens a local `local-topic` tab.
 */
export function useTopicsTabs(): TopicsTabsContextValue {
  const ws = useWorkspaceTabs();
  return useMemo(
    () => ({
      tabs: ws.tabs,
      setTabs: ws.setTabs,
      activeTabId: ws.activeTabId,
      setActiveTabId: ws.setActiveTabId,
      openTopic: ws.openLocalTopic,
      openLocalTrail: ws.openLocalTrail,
    }),
    [ws],
  );
}
