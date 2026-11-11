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
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { DocumentRange } from '../../shared/documentRange';
import type { Skill } from '../panels/agent-panels/skills/hooks/useSkillsData';
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
  SpecTab,
  TopicsHomeTab,
  LocalTopicTab,
  DrawingTab,
  SkillTab,
  SubsystemModelTab,
  C4SketchTab,
  BuildConfigurationTab,
  LocalhostBrowserTab,
  TerminalTab,
  OpenBotChatTab,
  HttpRequestTab,
} from '../events/portalTabs';
import { specTabLabel } from '../specs-view/specPaths';
import type { RepositorySelectedPayload } from '../events/repositorySelected';
import { ProcessRegistryService } from '../main-process-api/ProcessRegistryService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { useTopicRemoved } from '../topics-view/useTopicRemoved';
import type {
  CatalogRequest,
  SavedRequest,
} from '../../shared/requests/preparedRequest';
import { useRequestPins } from '../requests/useRequestPins';
import {
  createWorkspaceTabsSnapshot,
  restoreWorkspaceTabsSnapshot,
} from './workspaceTabPersistence';
import {
  browserTabId,
  openOrNavigateLocalhostBrowser,
  syncBrowserProcesses,
} from './browserTabs';

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
  // Specs (OpenSpec)
  | SpecTab
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
  | C4SketchTab
  | BuildConfigurationTab
  // Processes
  | LocalhostBrowserTab
  | OpenBotChatTab
  | HttpRequestTab;

// ----------------------------------------------------------------------------
// Slice shapes
// ----------------------------------------------------------------------------

/** The shared bucket, as the `WorkspaceShell` sees it. */
export interface WorkspaceTabsContextValue {
  openHttpRequest: (request: SavedRequest) => string;
  /** Favorites only. Definitions live in encrypted storage, not preferences. */
  savedRequests: SavedRequest[];
  /** All remembered routes, including closed, unpinned definitions. */
  catalogRequests: CatalogRequest[];
  /** True after the initial remembered-request catalog read has completed. */
  catalogRequestsLoaded: boolean;
  updateRequest: (request: SavedRequest) => Promise<void>;
  forgetRequest: (id: string) => Promise<void>;
  saveRequest: (request: SavedRequest) => Promise<void>;
  unpinRequest: (id: string) => Promise<void>;
  requestPinError: string | null;
  requestPinBusy: boolean;
  refreshSavedRequests: () => Promise<void>;
  tabs: WorkspaceTab[];
  setTabs: React.Dispatch<React.SetStateAction<WorkspaceTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  // Topics / docs
  /** Open a `local-topic-<topicId>` tab (an on-disk topic). */
  openLocalTopic: (topicId: string, title?: string) => void;
  /** Open a `markdown-doc-<filePath>` tab. */
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
  /** Open a `spec-<filePath>` tab (an OpenSpec spec file). */
  openSpec: (filePath: string, repositoryPath?: string) => void;
  /** Open a source tab, or navigate its existing editor to the supplied span. */
  openSourceFile: (filePath: string, range?: DocumentRange) => void;
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
  openSkill: (skill: Skill) => void;
  /** Open or focus a subsystem model tab. */
  openSubsystemModel: (modelId: string, title: string) => void;
  /** Open or focus a build configuration tab. */
  openBuildConfiguration: (
    configId: string,
    title?: string,
    repo?: string,
  ) => void;
  /** Open or focus a standalone authored C4 sketch tab. */
  openC4Sketch: (sketchId: string, title: string) => void;
  /** Open or navigate a browser tab, keyed by managed process or localhost origin. */
  openLocalhostBrowser: (
    port: number,
    path?: string,
    label?: string,
    processId?: string,
  ) => string;
  /** Open or focus a native chat surface, optionally scoped to one bot. */
  openOpenBotChat: (bot?: { agentId: string; name: string }) => void;
  /**
   * Rename the active tab (or clear the rename with an empty name). Sets
   * `customLabel`, which the tab strip and Home prefer over the computed
   * label; the domain label underneath is untouched, so clearing restores it.
   */
  renameTab: (tabId: string, name: string) => void;
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

/** Null-tolerant read for surfaces that render outside the tab provider. */
export function useWorkspaceTabsOptional(): WorkspaceTabsContextValue | null {
  return useContext(WorkspaceTabsContext);
}

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
  const [workspaceTabsLoaded, setWorkspaceTabsLoaded] = useState(false);
  const workspaceRestoreStarted = useRef(false);
  const requestPins = useRequestPins();

  // Restore once, after the secure request catalog has been read so prepared
  // request tabs can be rebuilt from their IDs without copying request bodies
  // or credentials into ordinary preferences.
  useEffect(() => {
    if (!requestPins.catalogRequestsLoaded || workspaceRestoreStarted.current)
      return;
    workspaceRestoreStarted.current = true;
    let cancelled = false;

    void UserPreferencesService.getPreferences()
      .then((preferences) => {
        if (cancelled) return;
        const restored = restoreWorkspaceTabsSnapshot(
          preferences.interactiveShell?.workspaceTabs,
          requestPins.catalogRequests,
        );
        if (restored) {
          setTabs((current) => {
            const currentById = new Map(current.map((tab) => [tab.id, tab]));
            const restoredIds = new Set(restored.tabs.map((tab) => tab.id));
            return [
              ...restored.tabs.map((tab) => currentById.get(tab.id) ?? tab),
              ...current.filter((tab) => !restoredIds.has(tab.id)),
            ];
          });
          setActiveTabId(
            (current) => current ?? restored.activeTabId ?? null,
          );
        }
      })
      .catch((error) => {
        console.error('[WorkspaceTabs] Failed to restore open tabs:', error);
      })
      .finally(() => {
        if (!cancelled) setWorkspaceTabsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [requestPins.catalogRequests, requestPins.catalogRequestsLoaded]);

  // Debounce writes so reorder/rename operations persist as one coherent
  // snapshot. The readiness guard prevents the initial empty state from
  // overwriting the saved workspace while restoration is in flight.
  useEffect(() => {
    if (!workspaceTabsLoaded) return;
    const timeout = setTimeout(() => {
      void UserPreferencesService.updatePreferences({
        interactiveShell: {
          workspaceTabs: createWorkspaceTabsSnapshot(tabs, activeTabId),
        },
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [activeTabId, tabs, workspaceTabsLoaded]);

  useTopicRemoved(
    useCallback(
      (topicId) => {
        const isDeleted = (tab: WorkspaceTab) =>
          tab.contentType === 'local-topic' && tab.topicId === topicId;
        const removedIds = new Set(tabs.filter(isDeleted).map((tab) => tab.id));
        if (removedIds.size === 0) return;
        const remaining = tabs.filter((tab) => !isDeleted(tab));
        setTabs((prev) => prev.filter((tab) => !isDeleted(tab)));
        setActiveTabId((current) =>
          current && removedIds.has(current)
            ? (remaining[0]?.id ?? null)
            : current,
        );
      },
      [tabs],
    ),
  );

  const linkedBrowserIds = tabs
    .filter(
      (tab): tab is LocalhostBrowserTab =>
        tab.contentType === 'localhost-browser' && !!tab.processId,
    )
    .map((tab) => tab.processId)
    .sort()
    .join('\0');

  useEffect(() => {
    if (!linkedBrowserIds) return;
    let cancelled = false;
    let receivedUpdate = false;
    const unsubscribe = ProcessRegistryService.onChanged((processes) => {
      receivedUpdate = true;
      setTabs((prev) => syncBrowserProcesses(prev, processes));
    });
    void ProcessRegistryService.list()
      .then((processes) => {
        if (!cancelled && !receivedUpdate) {
          setTabs((prev) => syncBrowserProcesses(prev, processes));
        }
      })
      .catch((error) =>
        console.error('Failed to load linked browser processes', error),
      );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [linkedBrowserIds]);

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

  const openSpec = useCallback(
    (filePath: string, repositoryPath?: string) => {
      openTab(
        `spec-${filePath}`,
        () =>
          ({
            id: `spec-${filePath}`,
            label: specTabLabel(filePath),
            contentType: 'spec',
            closable: true,
            filePath,
            repositoryPath,
          }) as SpecTab,
      );
    },
    [openTab],
  );

  const openSourceFile = useCallback(
    (filePath: string, range?: DocumentRange) => {
      const id = `source-file-${filePath}`;
      setTabs((previous) => {
        const existing = previous.find((tab) => tab.id === id) as
          | SourceFileTab
          | undefined;
        if (existing) {
          if (!range) return previous;
          return previous.map((tab) =>
            tab.id === id
              ? {
                  ...existing,
                  range,
                  rangeRevision: (existing.rangeRevision ?? 0) + 1,
                }
              : tab,
          );
        }
        return [
          ...previous,
          {
            id,
            label: filePath.split('/').pop() || 'File',
            contentType: 'source-file',
            closable: true,
            filePath,
            range,
            rangeRevision: range ? 1 : undefined,
          } as SourceFileTab,
        ];
      });
      setActiveTabId(id);
    },
    [],
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
      openTab(
        tabId,
        () =>
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

  const openSkill = useCallback(
    (skill: Skill) => {
      const id = `skill-${skill.id}`;
      openTab(
        id,
        () =>
          ({
            id,
            label: skill.name || 'Skill',
            contentType: 'skill',
            closable: true,
            skillId: skill.id,
            skill,
          }) as SkillTab,
      );
    },
    [openTab],
  );

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

  const openC4Sketch = useCallback(
    (sketchId: string, title: string) => {
      const id = `c4-sketch-${sketchId}`;
      openTab(id, () => ({
        id,
        label: title || 'C4 Sketch',
        contentType: 'c4-sketch',
        closable: true,
        sketchId,
      }));
    },
    [openTab],
  );

  const openBuildConfiguration = useCallback(
    (configId: string, title?: string, repo?: string) => {
      const id = `build-configuration-${configId}`;
      openTab(
        id,
        () =>
          ({
            id,
            label: title || 'Build configuration',
            contentType: 'build-configuration',
            closable: true,
            configId,
            repo,
          }) as BuildConfigurationTab,
      );
    },
    [openTab],
  );

  const openLocalhostBrowser = useCallback(
    (port: number, path = '/', label?: string, processId?: string) => {
      const target = { port, path, label, processId };
      const id = browserTabId(target);
      setTabs((prev) => openOrNavigateLocalhostBrowser(prev, target));
      setActiveTabId(id);
      return id;
    },
    [],
  );

  const openOpenBotChat = useCallback(
    (bot?: { agentId: string; name: string }) => {
      const id = bot ? `openbot-chat-${bot.agentId}` : 'openbot-chat';
      openTab(
        id,
        () =>
          ({
            id,
            label: bot?.name ?? 'OpenBot',
            contentType: 'openbot-chat',
            closable: true,
            agentId: bot?.agentId,
            botName: bot?.name,
          }) as OpenBotChatTab,
      );
    },
    [openTab],
  );

  const openHttpRequest = useCallback(
    (request: SavedRequest) => {
      const id = `http-request-${request.id}`;
      openTab(id, () => ({
        id,
        label: request.title,
        contentType: 'http-request',
        closable: true,
        savedRequestId: request.id,
        sessionId: crypto.randomUUID(),
        repositoryPath: request.repositoryPath,
        target: request.target,
        panelState: {
          request: request.request,
          requestId: request.id,
          environment: request.environment,
          environmentName: null,
          response: null,
          error: null,
          isSending: false,
        },
      }));
      return id;
    },
    [openTab],
  );

  const renameTab = useCallback((tabId: string, name: string) => {
    const trimmed = name.trim();
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? { ...tab, customLabel: trimmed ? trimmed : undefined }
          : tab,
      ),
    );
  }, []);

  return useMemo<WorkspaceTabsContextValue>(
    () => ({
      ...requestPins,
      openHttpRequest,
      tabs,
      setTabs,
      activeTabId,
      setActiveTabId,
      renameTab,
      openLocalTopic,
      openMarkdownDoc,
      openSpec,
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
      openC4Sketch,
      openBuildConfiguration,
      openLocalhostBrowser,
      openOpenBotChat,
    }),
    [
      requestPins,
      openHttpRequest,
      tabs,
      activeTabId,
      renameTab,
      openLocalTopic,
      openMarkdownDoc,
      openSpec,
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
      openC4Sketch,
      openBuildConfiguration,
      openLocalhostBrowser,
      openOpenBotChat,
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
