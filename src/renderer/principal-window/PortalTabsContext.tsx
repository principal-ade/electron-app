/**
 * PortalTabsContext
 *
 * Single owner of the workspace tab state for all three surfaces
 * (Projects / Inbox / Topics). Portal-unification Increment 2b: the three former
 * providers — `ProjectsTabsProvider` / `InboxTabsProvider` / `TopicsTabsProvider`
 * — are consolidated into one `PortalTabsProvider` that holds all three
 * per-surface buckets and provides each through its own (still separate) React
 * context. Every surface keeps its own independent tab list + `activeTabId` and
 * its own render isolation, so this is behavior-identical to the three providers
 * it replaces — it just gives the buckets one owner.
 *
 * The per-surface compat hooks `useProjectsTabs` / `useInboxTabs` /
 * `useTopicsTabs` are re-exported from their old `contexts/*TabsContext` module
 * paths, so every existing consumer is unchanged. These three buckets collapse
 * into a single tab list over one persistent host in Increment 3.
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
  UserProfileTab,
} from '../projects-view/ProjectsPanelFramework';
import type {
  InboxTab,
  InboxHomeTab,
  TopicTab,
} from '../inbox-view/InboxPanelFramework';
import type {
  TopicsTab,
  TopicsHomeTab,
  LocalTopicTab,
} from '../topics-view/TopicsPanelFramework';
import type {
  SharedTrailTab,
  LocalTrailTab,
  MarkdownDocTab,
} from '../events/portalTabs';
import type { RepositorySelectedPayload } from '../events/repositorySelected';

// ----------------------------------------------------------------------------
// Per-surface slice shapes (unchanged from the three former *TabsContextValues).
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

export interface InboxTabsContextValue {
  tabs: InboxTab[];
  setTabs: React.Dispatch<React.SetStateAction<InboxTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openSharedTrail: (trailId: string, owner?: string, repo?: string) => void;
  openTopic: (topicId: string, title?: string) => void;
  openLocalTrail: (trailId: string, title?: string) => void;
  openMarkdownDoc: (filePath: string, repositoryPath?: string) => void;
}

export interface TopicsTabsContextValue {
  tabs: TopicsTab[];
  setTabs: React.Dispatch<React.SetStateAction<TopicsTab[]>>;
  activeTabId: string | null;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | null>>;
  openTopic: (topicId: string, title?: string) => void;
  openLocalTrail: (trailId: string, title?: string) => void;
}

const ProjectsTabsContext = createContext<ProjectsTabsContextValue | null>(null);
const InboxTabsContext = createContext<InboxTabsContextValue | null>(null);
const TopicsTabsContext = createContext<TopicsTabsContextValue | null>(null);

// ----------------------------------------------------------------------------
// Projects slice
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
// Inbox slice
// ----------------------------------------------------------------------------

const INBOX_INITIAL_TABS: InboxTab[] = [
  {
    id: 'inbox-home',
    contentType: 'inbox-home',
    label: 'Inbox',
  } as InboxHomeTab,
];

function useInboxTabsValue(): InboxTabsContextValue {
  const [tabs, setTabs] = useState<InboxTab[]>(INBOX_INITIAL_TABS);
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

  return useMemo<InboxTabsContextValue>(
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
}

// ----------------------------------------------------------------------------
// Topics slice
// ----------------------------------------------------------------------------

const TOPICS_INITIAL_TABS: TopicsTab[] = [
  {
    id: 'topics-home',
    contentType: 'topics-home',
    label: 'Topics',
  } as TopicsHomeTab,
];

function useTopicsTabsValue(): TopicsTabsContextValue {
  const [tabs, setTabs] = useState<TopicsTab[]>(TOPICS_INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string | null>('topics-home');

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

  return useMemo<TopicsTabsContextValue>(
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
}

// ----------------------------------------------------------------------------
// Unified provider + per-surface hooks
// ----------------------------------------------------------------------------

/**
 * Owns all three surfaces' tab buckets and provides each through its own
 * context, so a consumer only re-renders when *its* surface changes.
 */
export const PortalTabsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const projects = useProjectsTabsValue();
  const inbox = useInboxTabsValue();
  const topics = useTopicsTabsValue();

  return (
    <ProjectsTabsContext.Provider value={projects}>
      <InboxTabsContext.Provider value={inbox}>
        <TopicsTabsContext.Provider value={topics}>
          {children}
        </TopicsTabsContext.Provider>
      </InboxTabsContext.Provider>
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

export function useInboxTabs(): InboxTabsContextValue {
  const ctx = useContext(InboxTabsContext);
  if (!ctx) {
    throw new Error('useInboxTabs must be used within PortalTabsProvider');
  }
  return ctx;
}

export function useTopicsTabs(): TopicsTabsContextValue {
  const ctx = useContext(TopicsTabsContext);
  if (!ctx) {
    throw new Error('useTopicsTabs must be used within PortalTabsProvider');
  }
  return ctx;
}
