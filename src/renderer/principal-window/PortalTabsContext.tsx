/**
 * PortalTabsContext
 *
 * Owner of the workspace tab state. Portal-unification Increment 3: Projects
 * and Topics share ONE persistent bucket — a single tab list +
 * `activeTabId` hosted by `WorkspaceShell`, so switching the left panel between
 * the surfaces keeps your open tabs and a single terminal.
 *
 * `useWorkspaceTabs` is the shell's view of that bucket. The legacy per-surface
 * compat hooks still work — `useProjectsTabs` (repo/profile opens + the titlebar's
 * direct calls) and `useTopicsTabs` (local `local-topic`) read the shared bucket.
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
  CommitReviewTab,
  ProjectInfoTab,
  RepoExplorerTab,
  UserProfileTab,
  OrgProfileTab,
  FileCityGuideTab,
  MarkdownDocTab,
  SourceFileTab,
  MediaTab,
  TopicsHomeTab,
  LocalTopicTab,
  DrawingTab,
  SkillTab,
  SubsystemModelTab,
  LocalhostBrowserTab,
} from '../events/portalTabs';
import type { RepositorySelectedPayload } from '../events/repositorySelected';

/**
 * The unified workspace tab union hosted by `WorkspaceShell` — the superset of
 * the former Projects (`FeedTab`) and Topics unions (deduped).
 */
export type WorkspaceTab =
  | TerminalTab
  | TopicsHomeTab
  | LocalTopicTab
  | MarkdownDocTab
  | SourceFileTab
  | MediaTab
  // Projects
  | CommitReviewTab
  | ProjectInfoTab
  | RepoExplorerTab
  | UserProfileTab
  | OrgProfileTab
  | FileCityGuideTab
  // Drawings
  | DrawingTab
  // Skills
  | SkillTab
  | SubsystemModelTab
  // Processes
  | LocalhostBrowserTab;

// ----------------------------------------------------------------------------
// Slice shapes
// ----------------------------------------------------------------------------

/** The shared bucket, as the `WorkspaceShell` sees it. */
export interface WorkspaceTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  // Topics / docs
  /** Open a `local-topic-<topicId>` tab (an on-disk topic). */
  openLocalTopic: (topicId: string, title?: string) => void;
  /** Open a `markdown-doc-<filePath>` tab. */
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
  /** Open a `source-file-<filePath>` tab (read-only code viewer). */
  openSourceFile: (filePath: string) => void;
  /** Open a `media-<filePath>` tab (image/video viewer). */
  openMedia: (filePath: string) => void;
  // Projects
  /** Open a `project-info-<purl>` tab idempotently and focus it. */
  openProjectInfo: (payload: RepositorySelectedPayload) => void;
  /** Open a `repo-explorer-<purl>` tab idempotently and focus it. */
  openRepoExplorer: (payload: RepositorySelectedPayload) => void;
  /** Open a `user-profile-<username>` tab idempotently and focus it. */
  openUserProfile: (username: string, email?: string) => void;
  /** Open an `org-profile-<orgName>` tab idempotently and focus it. */
  openOrgProfile: (orgName: string) => void;
  /**
   * Open a `file-city-guide-<purl>` tab idempotently and focus it.
   * Optional `options` update guide modes (readme / week); turning one on
   * clears the other. Omit options to open/focus without changing modes.
   */
  openFileCityGuide: (
    payload: RepositorySelectedPayload,
    options?: {
      readmeActive?: boolean;
      readmePath?: string;
      weekActive?: boolean;
    },
  ) => void;
  /** Open (or focus) a `drawing` tab, deduped by drawing id. */
  openDrawing: (payload: {
    drawingId: string;
    path?: string;
    name: string;
  }) => void;
  /** Open (or focus) the singleton `skill` detail tab; updates its label. */
  openSkill: (label: string) => void;
  /** Open or focus a subsystem model tab. */
  openSubsystemModel: (modelId: string, title: string) => void;
  /** Open (or focus) an embedded localhost browser tab for a dev-server port. */
  openLocalhostBrowser: (port: number, path?: string, label?: string) => void;
}

/** Back-compat shape for `useProjectsTabs` (titlebar + IntegratedShell). */
export interface ProjectsTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openProjectInfo: (payload: RepositorySelectedPayload) => void;
  openUserProfile: (username: string, email?: string) => void;
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
}

/** Back-compat shape for `useTopicsTabs` (its `openTopic` = local topic). */
export interface TopicsTabsContextValue {
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openTopic: (topicId: string, title?: string) => void;
}

const WorkspaceTabsContext = createContext<WorkspaceTabsContextValue | null>(
  null,
);

// ----------------------------------------------------------------------------
// Shared workspace bucket (Projects + Topics)
// ----------------------------------------------------------------------------
//
// The bucket starts empty: nothing is auto-opened on the workspace surface, so
// the tab strip is blank until the user opens something (a repo profile, topic,
// doc, terminal, …). The Sky View overlay is the landing surface; that is where
// the "what needs attention" views live now.

function useWorkspaceTabsValue(): WorkspaceTabsContextValue {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Idempotent open helper: focus the tab if present, else append `make()`.
  const openTab = useCallback((tabId: string, make: () => WorkspaceTab) => {
    setTabs((prev) =>
      prev.some((t) => t.id === tabId) ? prev : [...prev, make()],
    );
    setActiveTabId(tabId);
  }, []);

  const openLocalTopic = useCallback(
    (topicId: string, title?: string) => {
      openTab(
        `local-topic-${topicId}`,
        () =>
          ({
            id: `local-topic-${topicId}`,
            label: title || 'Topic',
            contentType: 'local-topic',
            closable: true,
            topicId,
            title,
          }) as LocalTopicTab,
      );
    },
    [openTab],
  );

  const openMarkdownDoc = useCallback(
    (filePath: string, repositoryPath?: string) => {
      openTab(
        `markdown-doc-${filePath}`,
        () =>
          ({
            id: `markdown-doc-${filePath}`,
            label: filePath.split('/').pop() || 'Document',
            contentType: 'markdown-doc',
            closable: true,
            filePath,
            repositoryPath,
          }) as MarkdownDocTab,
      );
    },
    [openTab],
  );

  const openSourceFile = useCallback(
    (filePath: string) => {
      openTab(
        `source-file-${filePath}`,
        () =>
          ({
            id: `source-file-${filePath}`,
            label: filePath.split('/').pop() || 'File',
            contentType: 'source-file',
            closable: true,
            filePath,
          }) as SourceFileTab,
      );
    },
    [openTab],
  );

  const openMedia = useCallback(
    (filePath: string) => {
      const fileName = filePath.split('/').pop() || 'Media';
      openTab(
        `media-${filePath}`,
        () =>
          ({
            id: `media-${filePath}`,
            label: fileName,
            contentType: 'media',
            closable: true,
            filePath,
          }) as MediaTab,
      );
    },
    [openTab],
  );

  const openRepoExplorer = useCallback(
    (payload: RepositorySelectedPayload) => {
      const { purl, github, localEntry } = payload;
      openTab(
        `repo-explorer-${purl}`,
        () =>
          ({
            id: `repo-explorer-${purl}`,
            label: github ? `${github.owner}/${github.name}` : String(purl),
            contentType: 'repo-explorer',
            closable: true,
            purl,
            github,
            localEntry,
          }) as RepoExplorerTab,
      );
    },
    [openTab],
  );

  /**
   * Open a repository. The default surface depends on clone state:
   *   - remote-only (no local clone, has a GitHub identity) → the explorer
   *   - cloned locally, or local-only (no GitHub identity) → the profile panel
   * The profile panel's value is local-clone management, which doesn't apply to
   * a remote-only repo; the explorer can't render without an owner/repo.
   */
  const openProjectInfo = useCallback(
    (payload: RepositorySelectedPayload) => {
      const { purl, github, localEntry, localClones } = payload;
      const isLocal =
        Boolean(localEntry?.path) || (localClones?.length ?? 0) > 0;
      const hasGithub = Boolean(github?.owner && github?.name);
      if (!isLocal && hasGithub) {
        openRepoExplorer(payload);
        return;
      }
      openTab(
        `project-info-${purl}`,
        () =>
          ({
            id: `project-info-${purl}`,
            label: github ? `${github.owner}/${github.name}` : String(purl),
            contentType: 'project-info',
            closable: true,
            purl,
            github,
            localEntry,
          }) as ProjectInfoTab,
      );
    },
    [openTab, openRepoExplorer],
  );

  const openUserProfile = useCallback(
    (username: string, email?: string) => {
      openTab(
        `user-profile-${username}`,
        () =>
          ({
            id: `user-profile-${username}`,
            label: `@${username}`,
            contentType: 'user-profile',
            closable: true,
            username,
            email,
          }) as UserProfileTab,
      );
    },
    [openTab],
  );

  const openOrgProfile = useCallback(
    (orgName: string) => {
      openTab(
        `org-profile-${orgName}`,
        () =>
          ({
            id: `org-profile-${orgName}`,
            label: `@${orgName}`,
            contentType: 'org-profile',
            closable: true,
            orgName,
          }) as OrgProfileTab,
      );
    },
    [openTab],
  );

  const openFileCityGuide = useCallback(
    (
      payload: RepositorySelectedPayload,
      options?: {
        readmeActive?: boolean;
        readmePath?: string;
        weekActive?: boolean;
      },
    ) => {
      const { purl, github, localEntry } = payload;
      const tabId = `file-city-guide-${purl}`;
      const hasModeUpdate =
        options != null &&
        (options.readmeActive !== undefined ||
          options.weekActive !== undefined ||
          options.readmePath !== undefined);

      // Mode update: merge into existing tab or create one.
      if (hasModeUpdate) {
        let readmeActive = options.readmeActive;
        let readmePath = options.readmePath;
        let weekActive = options.weekActive;
        // Mutual exclusivity — turning one mode on clears the other.
        if (readmeActive === true) weekActive = false;
        if (weekActive === true) readmeActive = false;

        setTabs((prev) => {
          const exists = prev.some((t) => t.id === tabId);
          if (exists) {
            return prev.map((t) => {
              if (t.id !== tabId) return t;
              const next = { ...t } as FileCityGuideTab;
              if (readmeActive !== undefined) next.readmeActive = readmeActive;
              if (readmePath !== undefined) next.readmePath = readmePath;
              if (weekActive !== undefined) next.weekActive = weekActive;
              return next;
            });
          }
          return [
            ...prev,
            {
              id: tabId,
              label: github
                ? `${github.owner}/${github.name} · City`
                : `City · ${String(purl)}`,
              contentType: 'file-city-guide',
              closable: true,
              purl,
              github,
              localEntry,
              readmeActive: readmeActive ?? false,
              readmePath,
              weekActive: weekActive ?? false,
            } as FileCityGuideTab,
          ];
        });
        setActiveTabId(tabId);
        return;
      }

      // Open / focus without changing modes.
      openTab(tabId, () =>
        ({
          id: tabId,
          label: github
            ? `${github.owner}/${github.name} · City`
            : `City · ${String(purl)}`,
          contentType: 'file-city-guide',
          closable: true,
          purl,
          github,
          localEntry,
          readmeActive: false,
          weekActive: false,
        }) as FileCityGuideTab,
      );
    },
    [openTab],
  );

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

  const openSubsystemModel = useCallback(
    (modelId: string, title: string) => {
      const id = `subsystem-model-${modelId}`;
      openTab(
        id,
        () =>
          ({
            id,
            label: title || 'Subsystem Model',
            contentType: 'subsystem-model',
            closable: true,
            modelId,
          }) as SubsystemModelTab,
      );
    },
    [openTab],
  );

  // Embedded localhost browser — one tab per port, deduped by the port.
  const openLocalhostBrowser = useCallback(
    (port: number, path?: string, label?: string) => {
      const id = `localhost-browser-${port}`;
      openTab(
        id,
        () =>
          ({
            id,
            label: label || `localhost:${port}`,
            contentType: 'localhost-browser',
            closable: true,
            port,
            path,
          }) as LocalhostBrowserTab,
      );
    },
    [openTab],
  );

  return useMemo<WorkspaceTabsContextValue>(
    () => ({
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      openLocalTopic,
      openMarkdownDoc,
      openSourceFile,
      openMedia,
      openProjectInfo,
      openRepoExplorer,
      openUserProfile,
      openOrgProfile,
      openFileCityGuide,
      openDrawing,
      openSkill,
      openSubsystemModel,
      openLocalhostBrowser,
    }),
    [
      tabs,
      activeTabId,
      openLocalTopic,
      openMarkdownDoc,
      openSourceFile,
      openMedia,
      openProjectInfo,
      openRepoExplorer,
      openUserProfile,
      openOrgProfile,
      openFileCityGuide,
      openDrawing,
      openSkill,
      openSubsystemModel,
      openLocalhostBrowser,
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
 * (consumed by the titlebar repo/user picker).
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
    }),
    [ws],
  );
}
