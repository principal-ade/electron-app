/**
 * PortalTabsContext
 *
 * Owner of the workspace tab state. Portal-unification Increment 3: Projects,
 * Inbox, and Topics now share ONE persistent bucket — a single tab list +
 * `activeTabId` hosted by `WorkspaceShell`, so switching the left panel between
 * the three surfaces keeps your open tabs and a single terminal.
 *
 * `useWorkspaceTabs` is the shell's view of that bucket. The legacy per-surface
 * compat hooks still work — `useProjectsTabs` (repo/profile opens + the titlebar's
 * direct calls), `useInboxTabs` (web-ade `topic`) and `useTopicsTabs` (local
 * `local-topic`) all read the shared bucket.
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
  CommitReviewTab,
  LiveActivityTab,
  InProgressActivityTab,
  ProjectInfoTab,
  UserProfileTab,
  OrgProfileTab,
  CollectionProfileTab,
  OwnerActivityTab,
  RepoActivityTab,
  SharedTrailTab,
  LocalTrailTab,
  MarkdownDocTab,
  InboxHomeTab,
  TopicTab,
  TopicsHomeTab,
  LocalTopicTab,
  DrawingTab,
  SkillTab,
} from '../events/portalTabs';
import type { RepositorySelectedPayload } from '../events/repositorySelected';
import type { StarredCollection } from '../../shared/tipc/webAdeRouterTypes';

/**
 * The unified workspace tab union hosted by `WorkspaceShell` — the superset of
 * the former Projects (`FeedTab`), Inbox and Topics unions (deduped; all three
 * carried `TerminalTab` and the trail/markdown tabs).
 */
export type WorkspaceTab =
  | TerminalTab
  | InboxHomeTab
  | TopicsHomeTab
  | SharedTrailTab
  | TopicTab
  | LocalTopicTab
  | LocalTrailTab
  | MarkdownDocTab
  // Projects
  | CommitReviewTab
  | LiveActivityTab
  | ActivityFeedTab
  | InProgressActivityTab
  | ProjectInfoTab
  | UserProfileTab
  | OrgProfileTab
  | CollectionProfileTab
  | OwnerActivityTab
  | RepoActivityTab
  // Drawings
  | DrawingTab
  // Skills
  | SkillTab;

// ----------------------------------------------------------------------------
// Slice shapes
// ----------------------------------------------------------------------------

/** The shared bucket, as the `WorkspaceShell` sees it. */
export interface WorkspaceTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  // Trails / topics / docs
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
  // Projects
  /** Open a `project-info-<purl>` tab idempotently and focus it. */
  openProjectInfo: (payload: RepositorySelectedPayload) => void;
  /** Open a `user-profile-<username>` tab idempotently and focus it. */
  openUserProfile: (username: string, email?: string) => void;
  /** Open an `org-profile-<orgName>` tab idempotently and focus it. */
  openOrgProfile: (orgName: string) => void;
  /** Open a `collection-profile-<id>` tab idempotently and focus it. */
  openCollectionProfile: (collection: StarredCollection) => void;
  /** Open an `owner-activity-<login>` tab idempotently and focus it. */
  openOwnerActivity: (
    login: string,
    accountType: 'User' | 'Organization',
  ) => void;
  /** Open a `repo-activity-<owner>/<repo>` tab idempotently and focus it. */
  openRepoActivity: (owner: string, repo: string) => void;
  /** Open the singleton `live-activity` tab and focus it. */
  openLiveActivity: () => void;
  /** Open (or focus) a `drawing` tab, deduped by drawing id. */
  openDrawing: (payload: {
    drawingId: string;
    path?: string;
    name: string;
  }) => void;
  /** Open (or focus) the singleton `skill` detail tab; updates its label. */
  openSkill: (label: string) => void;
}

/** Back-compat shape for `useProjectsTabs` (titlebar + IntegratedShell). */
export interface ProjectsTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openProjectInfo: (payload: RepositorySelectedPayload) => void;
  openUserProfile: (username: string, email?: string) => void;
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
  openLocalTrail: (trailId: string, title?: string) => void;
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

const WorkspaceTabsContext = createContext<WorkspaceTabsContextValue | null>(
  null,
);

// ----------------------------------------------------------------------------
// Shared workspace bucket (Projects + Inbox + Topics)
// ----------------------------------------------------------------------------

const WORKSPACE_INITIAL_TABS: WorkspaceTab[] = [
  {
    id: 'activity-feed',
    contentType: 'activity-feed',
    label: 'Recent Activity',
  } as ActivityFeedTab,
  { id: 'inbox-home', contentType: 'inbox-home', label: 'Inbox' } as InboxHomeTab,
  {
    id: 'topics-home',
    contentType: 'topics-home',
    label: 'Topics',
  } as TopicsHomeTab,
];

function useWorkspaceTabsValue(): WorkspaceTabsContextValue {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(WORKSPACE_INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    'activity-feed',
  );

  // Idempotent open helper: focus the tab if present, else append `make()`.
  const openTab = useCallback(
    (tabId: string, make: () => WorkspaceTab) => {
      setTabs((prev) => (prev.some((t) => t.id === tabId) ? prev : [...prev, make()]));
      setActiveTabId(tabId);
    },
    [],
  );

  const openSharedTrail = useCallback(
    (trailId: string, owner?: string, repo?: string) => {
      openTab(`shared-trail-${trailId}`, () => ({
        id: `shared-trail-${trailId}`,
        label: repo ? `${owner}/${repo}` : 'Shared trail',
        contentType: 'shared-trail',
        closable: true,
        trailId,
        owner,
        repo,
      }) as SharedTrailTab);
    },
    [openTab],
  );

  const openWebAdeTopic = useCallback(
    (topicId: string, title?: string) => {
      openTab(`topic-${topicId}`, () => ({
        id: `topic-${topicId}`,
        label: title || 'Topic',
        contentType: 'topic',
        closable: true,
        topicId,
      }) as TopicTab);
    },
    [openTab],
  );

  const openLocalTopic = useCallback(
    (topicId: string, title?: string) => {
      openTab(`local-topic-${topicId}`, () => ({
        id: `local-topic-${topicId}`,
        label: title || 'Topic',
        contentType: 'local-topic',
        closable: true,
        topicId,
        title,
      }) as LocalTopicTab);
    },
    [openTab],
  );

  const openLocalTrail = useCallback(
    (trailId: string, title?: string) => {
      openTab(`local-trail-${trailId}`, () => ({
        id: `local-trail-${trailId}`,
        label: title || 'Trail',
        contentType: 'local-trail',
        closable: true,
        trailId,
      }) as LocalTrailTab);
    },
    [openTab],
  );

  const openMarkdownDoc = useCallback(
    (filePath: string, repositoryPath?: string) => {
      openTab(`markdown-doc-${filePath}`, () => ({
        id: `markdown-doc-${filePath}`,
        label: filePath.split('/').pop() || 'Document',
        contentType: 'markdown-doc',
        closable: true,
        filePath,
        repositoryPath,
      }) as MarkdownDocTab);
    },
    [openTab],
  );

  const openProjectInfo = useCallback(
    (payload: RepositorySelectedPayload) => {
      const { purl, github, localEntry } = payload;
      openTab(`project-info-${purl}`, () => ({
        id: `project-info-${purl}`,
        label: github ? `${github.owner}/${github.name}` : String(purl),
        contentType: 'project-info',
        closable: true,
        purl,
        github,
        localEntry,
      }) as ProjectInfoTab);
    },
    [openTab],
  );

  const openUserProfile = useCallback(
    (username: string, email?: string) => {
      openTab(`user-profile-${username}`, () => ({
        id: `user-profile-${username}`,
        label: `@${username}`,
        contentType: 'user-profile',
        closable: true,
        username,
        email,
      }) as UserProfileTab);
    },
    [openTab],
  );

  const openOrgProfile = useCallback(
    (orgName: string) => {
      openTab(`org-profile-${orgName}`, () => ({
        id: `org-profile-${orgName}`,
        label: `@${orgName}`,
        contentType: 'org-profile',
        closable: true,
        orgName,
      }) as OrgProfileTab);
    },
    [openTab],
  );

  const openCollectionProfile = useCallback(
    (collection: StarredCollection) => {
      openTab(`collection-profile-${collection.id}`, () => ({
        id: `collection-profile-${collection.id}`,
        label: collection.name,
        contentType: 'collection-profile',
        closable: true,
        collection,
      }) as CollectionProfileTab);
    },
    [openTab],
  );

  const openOwnerActivity = useCallback(
    (login: string, accountType: 'User' | 'Organization') => {
      openTab(`owner-activity-${login}`, () => ({
        id: `owner-activity-${login}`,
        label: `@${login}`,
        contentType: 'owner-activity',
        closable: true,
        login,
        accountType,
      }) as OwnerActivityTab);
    },
    [openTab],
  );

  const openRepoActivity = useCallback(
    (owner: string, repo: string) => {
      openTab(`repo-activity-${owner}/${repo}`, () => ({
        id: `repo-activity-${owner}/${repo}`,
        label: `${owner}/${repo}`,
        contentType: 'repo-activity',
        closable: true,
        owner,
        repo,
      }) as RepoActivityTab);
    },
    [openTab],
  );

  const openLiveActivity = useCallback(() => {
    openTab('live-activity', () => ({
      id: 'live-activity',
      label: 'Live Activity',
      contentType: 'live-activity',
      closable: true,
    }) as LiveActivityTab);
  }, [openTab]);

  // Deduped by the `drawingId` *field* (not the tab id) so a freshly-created
  // drawing — whose tab keeps its `new-<uuid>` tab id but whose `drawingId` is
  // rewritten to the real file id on first save — focuses instead of duplicating.
  const openDrawing = useCallback(
    (payload: { drawingId: string; path?: string; name: string }) => {
      const existing = tabs.find(
        (t) =>
          t.contentType === 'drawing' &&
          (t as DrawingTab).drawingId === payload.drawingId,
      );
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const id = `drawing-${payload.drawingId}`;
      setTabs((prev) =>
        prev.some((t) => t.id === id)
          ? prev
          : [
              ...prev,
              {
                id,
                label: payload.name || 'Drawing',
                contentType: 'drawing',
                closable: true,
                drawingId: payload.drawingId,
                path: payload.path,
                name: payload.name,
              } as DrawingTab,
            ],
      );
      setActiveTabId(id);
    },
    [tabs],
  );

  // Singleton skill detail tab — one tab follows the current selection; opening
  // a different skill just relabels + focuses it (content reads the surface
  // context, so no per-skill tab data).
  const openSkill = useCallback((label: string) => {
    const id = 'skill-detail';
    setTabs((prev) =>
      prev.some((t) => t.id === id)
        ? prev.map((t) => (t.id === id ? { ...t, label } : t))
        : [
            ...prev,
            {
              id,
              label: label || 'Skill',
              contentType: 'skill',
              closable: true,
            } as SkillTab,
          ],
    );
    setActiveTabId(id);
  }, []);

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
      openProjectInfo,
      openUserProfile,
      openOrgProfile,
      openCollectionProfile,
      openOwnerActivity,
      openRepoActivity,
      openLiveActivity,
      openDrawing,
      openSkill,
    }),
    [
      tabs,
      activeTabId,
      openSharedTrail,
      openWebAdeTopic,
      openLocalTopic,
      openLocalTrail,
      openMarkdownDoc,
      openProjectInfo,
      openUserProfile,
      openOrgProfile,
      openCollectionProfile,
      openOwnerActivity,
      openRepoActivity,
      openLiveActivity,
      openDrawing,
      openSkill,
    ],
  );
}

// ----------------------------------------------------------------------------
// Provider + hooks
// ----------------------------------------------------------------------------

export const PortalTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const workspace = useWorkspaceTabsValue();
  return (
    <WorkspaceTabsContext.Provider value={workspace}>
      {children}
    </WorkspaceTabsContext.Provider>
  );
};

export function useWorkspaceTabs(): WorkspaceTabsContextValue {
  const ctx = useContext(WorkspaceTabsContext);
  if (!ctx) {
    throw new Error('useWorkspaceTabs must be used within PortalTabsProvider');
  }
  return ctx;
}

/**
 * Back-compat: the Projects surface's view of the shared workspace bucket
 * (consumed by the titlebar repo/user picker and IntegratedShell's trail
 * handoff).
 */
export function useProjectsTabs(): ProjectsTabsContextValue {
  const ws = useWorkspaceTabs();
  return useMemo(
    () => ({
      tabs: ws.tabs,
      setTabs: ws.setTabs,
      activeTabId: ws.activeTabId,
      setActiveTabId: ws.setActiveTabId,
      openProjectInfo: ws.openProjectInfo,
      openUserProfile: ws.openUserProfile,
      openSharedTrail: ws.openSharedTrail,
      openLocalTrail: ws.openLocalTrail,
      openMarkdownDoc: ws.openMarkdownDoc,
    }),
    [ws],
  );
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
