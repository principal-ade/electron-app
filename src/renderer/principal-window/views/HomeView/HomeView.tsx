import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  BookOpen,
  Check,
  Compass,
  Download,
  ExternalLink,
  Footprints,
  Layers,
  PenTool,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Telescope,
} from 'lucide-react';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { GithubService } from '../../../main-process-api/GithubService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { ShellService } from '../../../main-process-api/ShellService';
import { TopicService } from '../../../main-process-api/TopicService';
import { WindowService } from '../../../main-process-api/WindowService';
import { useOpenRepositoryWindows } from '../../../hooks/useOpenRepositoryWindows';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { NewTopicModal } from '../../../components/NewTopicModal';
import { DeleteTopicConfirmDialog } from '../../../components/DeleteTopicConfirmDialog';
import { TrailPromptIdeas } from '../../components/TrailPromptIdeas';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type { SkillLockFile } from '../../../../shared/main-process-api-interfaces/SkillLockAPI';
import type {
  AlexandriaEntry,
} from '@principal-ai/alexandria-core-library/types';
import type { DraftTopic as Topic } from '@principal-ai/subsystems-core/node';
import {
  TopicsDashboard,
  type TopicsDashboardTopicEntry,
} from './TopicsDashboard';
import { OpenProjectCard, type OpenProjectEntry } from './OpenProjectCard';
import { getPrincipalBridgeUrl } from '../../../../shared/config/appBranding';
import { useTopicsTabs } from '../../contexts/TopicsTabsContext';

const trailRepoLabel = (repositoryPath: string | undefined): string => {
  if (!repositoryPath) return 'No repo';
  const trimmed = repositoryPath.replace(/[\\/]+$/, '');
  const idx = trimmed.search(/[\\/](?!.*[\\/])/);
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed;
};

const TRAIL_SKILL_REPO_OWNER = 'principal-ai';
const TRAIL_SKILL_REPO_NAME = 'skills';
const TRAIL_SKILL_BRANCH = 'main';
const TRAIL_SKILL_GITHUB_URL = `https://github.com/${TRAIL_SKILL_REPO_OWNER}/${TRAIL_SKILL_REPO_NAME}`;
// Normalized "owner/repo" source recorded in the skill lock file for skills that
// ship from the shared principal-ai/skills repo. Used to confirm an installed
// skill came from the expected repo, not just that *some* skill of the same name
// is present — see matchInstalledFromLock.
const TRAIL_SKILL_SOURCE = `${TRAIL_SKILL_REPO_OWNER}/${TRAIL_SKILL_REPO_NAME}`;

const TRAIL_INSTALL_SKILL_NAMES = [
  'convert-investigation',
  'author-investigation-trail',
  'author-informative-trail',
  'create-topic',
  'topic-context',
] as const;

const TRAIL_SKILL_DETAILS: ReadonlyArray<{
  name: (typeof TRAIL_INSTALL_SKILL_NAMES)[number];
  title: string;
  description: string;
  url: string;
  source: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    name: 'author-investigation-trail',
    title: 'Author Investigation Trail',
    description:
      'Capture an investigation as you debug — records the files, calls, and findings you walked through so the chain of reasoning is preserved.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-investigation-trail`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Search,
  },
  {
    name: 'author-informative-trail',
    title: 'Author Informative Trail',
    description:
      'Lay a guided tour through the code to explain how a feature or system works, so a teammate can follow the path without reverse-engineering it.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-informative-trail`,
    source: TRAIL_SKILL_SOURCE,
    Icon: BookOpen,
  },
  {
    name: 'convert-investigation',
    title: 'Convert Investigation',
    description:
      'Turn a raw investigation trail into a polished, shareable spec — cleans up the trail and forwards it through the convert pipeline.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/convert-investigation`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Share2,
  },
  {
    name: 'create-topic',
    title: 'Create Topic',
    description:
      'Create a topic — a subject brief scoped to its declared projects, with a description that doubles as the working brief for agents pointed at it.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/create-topic`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Plus,
  },
  {
    name: 'topic-context',
    title: 'Topic Context',
    description:
      'Read the topic an agent was briefed on and keep its description current — fetch the topic, append discovered context, or replace a status section in place.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/topic-context`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Layers,
  },
];

/** Display metadata shared by required and optional skill entries. */
interface SkillDetail {
  name: string;
  title: string;
  description: string;
  url: string;
  /**
   * Normalized "owner/repo" the skill ships from. A lock entry only counts as
   * *this* skill when its recorded `source` matches — the lock file keys by bare
   * name, so a same-named skill from another repo would otherwise read as
   * installed. See matchInstalledFromLock.
   */
  source: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

// Optional skills are NOT installed as part of the required trail bundle. They
// surface in the footer as individually installable add-ons, and show up among
// the "Installed Skills" badges once present.
const OPTIONAL_SKILL_NAMES = [
  'excalidraw-drawings',
  'principal-ai-desktop-app-tools',
  'file-city-tours',
  'search-local-topics-trails',
] as const;

const OPTIONAL_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  {
    name: 'excalidraw-drawings',
    title: 'Excalidraw Drawings',
    description:
      "Find and edit the app's Excalidraw drawings on disk — locate the .excalidraw JSON under ~/.alexandria/drawings and edit a diagram directly so an agent can collaborate on it.",
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/excalidraw-drawings`,
    source: TRAIL_SKILL_SOURCE,
    Icon: PenTool,
  },
  {
    name: 'principal-ai-desktop-app-tools',
    title: 'Principal Desktop App Tools',
    description: `Canonical reference for the app's local bridge — the HTTP surface at ${getPrincipalBridgeUrl()} that agents use to push trails, create topics, and leave notes on documents, plus the conventions every call shares.`,
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/principal-ai-desktop-app-tools`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Plug,
  },
  {
    name: 'file-city-tours',
    title: 'File City Tours',
    description:
      "Create and validate guided introduction tours for File City visualizations — build onboarding walkthroughs that highlight a codebase's architecture with interactive highlights, actions, and color modes.",
    // file-city-tours ships from the shared principal-ai/skills repo, same as the
    // trail skills above — installSkillsByName fetches every skill from there.
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/file-city-tours`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Compass,
  },
  {
    name: 'search-local-topics-trails',
    title: 'Search Local Topics & Trails',
    description:
      'Search the on-disk trail and topic indexes by title, summary, repo, or recency, then open a matching trail — a read-only way to find the local trails and topics already saved on this machine.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/search-local-topics-trails`,
    source: TRAIL_SKILL_SOURCE,
    Icon: Telescope,
  },
];

/** Every skill the home view knows how to display or install. */
const ALL_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  ...TRAIL_SKILL_DETAILS,
  ...OPTIONAL_SKILL_DETAILS,
];

/** Names whose install state the home view tracks (required + optional). */
const TRACKED_SKILL_NAMES: ReadonlyArray<string> = [
  ...TRAIL_INSTALL_SKILL_NAMES,
  ...OPTIONAL_SKILL_NAMES,
];

/**
 * Resolve which tracked skills are installed *from the repo we advertise*.
 *
 * The lock file keys entries by bare skill name, so presence-of-key alone can't
 * tell our `file-city-tours` (principal-ai/skills) apart from a same-named skill
 * installed from somewhere else (e.g. a stale principal-ai/file-city install). We
 * additionally
 * require the recorded `entry.source` to equal the catalog entry's `source`, so
 * the badge reflects *our* skill rather than any skill that happens to share the
 * name. Identity here is (name, source), even though storage still keys by name.
 */
function matchInstalledFromLock(lockFile: SkillLockFile | null): Set<string> {
  if (!lockFile) return new Set();
  return new Set(
    ALL_SKILL_DETAILS.filter((skill) => {
      const entry = lockFile.skills[skill.name];
      return entry != null && entry.source === skill.source;
    }).map((skill) => skill.name),
  );
}

export function HomeView() {
  const { theme } = useTheme();

  const [gitUserName, setGitUserName] = useState<string | null>(null);
  const [gitConfigOpen, setGitConfigOpen] = useState(false);

  const loadGitUserName = useCallback(async () => {
    try {
      const result = await GitService.execCommand(process.env.HOME || '/', [
        'config',
        '--global',
        'user.name',
      ]);
      setGitUserName(result.stdout.trim() || null);
    } catch {
      // No global git identity — leave gitUserName null and fall back.
    }
  }, []);

  useEffect(() => {
    void loadGitUserName();
  }, [loadGitUserName]);

  const [skillInstalled, setSkillInstalled] = useState<boolean | null>(null);
  const [installedSkillNames, setInstalledSkillNames] = useState<Set<string>>(
    new Set(),
  );
  const [installingSkill, setInstallingSkill] = useState(false);
  const [skillInstallError, setSkillInstallError] = useState<string | null>(
    null,
  );
  // Optional skills currently being installed, by name (independent of the
  // required-bundle install above).
  const [installingOptional, setInstallingOptional] = useState<Set<string>>(
    new Set(),
  );
  const [showSkillDetails, setShowSkillDetails] = useState(false);
  const [skillUpdates, setSkillUpdates] = useState<Set<string>>(new Set());
  const [updatingSkills, setUpdatingSkills] = useState<Set<string>>(new Set());

  // Dashboard data sources. Mirrors what TrailsView used to load.
  const [recentTrails, setRecentTrails] = useState<TrailIndexEntry[]>([]);
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  // Ids of topics published to web-ade (sync.remoteId present), from the
  // sync-aware records endpoint. Drives the "Shared" badge on topic cards.
  const [publishedTopicIds, setPublishedTopicIds] = useState<Set<string>>(
    new Set(),
  );
  const { openTopic: openTopicInTopicsView } = useTopicsTabs();

  // Topic modal state.
  const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);

  // Home-view keyboard shortcut: Cmd/Ctrl+T → open the create topic modal.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        setIsNewTopicOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  const [pendingDeleteTopic, setPendingDeleteTopic] =
    useState<TopicsDashboardTopicEntry | null>(null);
  const [deletingTopic, setDeletingTopic] = useState(false);

  // Projects that currently have a window open. Mapped from the live
  // repository-window list to repo identity + label/owner for the cards.
  const openRepoWindows = useOpenRepositoryWindows();
  const openProjects = useMemo<OpenProjectEntry[]>(() => {
    const seen = new Set<string>();
    const out: OpenProjectEntry[] = [];
    for (const win of openRepoWindows) {
      const path = win.localPath;
      if (!path || seen.has(path)) continue;
      seen.add(path);
      const repo = repositories.find((r) => r.path === path);
      out.push({
        key: path,
        label: repo?.github?.name ?? repo?.name ?? trailRepoLabel(path),
        ownerLogin: repo?.github?.owner,
      });
    }
    return out;
  }, [openRepoWindows, repositories]);

  // Open the dev workspace for a project path, registering it first if it isn't
  // a known Alexandria repo. Shared by the open-projects cards; opening an
  // already-open workspace focuses the existing window.
  const openProject = useCallback(async (path: string) => {
    try {
      const existing = await AlexandriaService.getRepositoryByPath(path);
      const alexandriaEntry =
        existing ?? (await AlexandriaService.registerRepository(path));
      await WindowService.openDevWorkspace({ alexandriaEntry });
    } catch (err) {
      console.error(
        '[HomeView] Failed to open dev workspace for project:',
        path,
        err,
      );
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await TrailLibraryService.list();
        if (cancelled) return;
        const sorted = [...result.entries].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        );
        setRecentTrails(sorted);
      } catch (error) {
        console.error('[HomeView] Failed to load recent trails:', error);
      }
    };
    void load();
    const off = TrailLibraryService.onLibraryChanged(() => {
      void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const repos = await AlexandriaService.getRepositories();
        if (!cancelled) setRepositories(repos);
      } catch (error) {
        console.error('[HomeView] Failed to load Alexandria entries:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    TopicService.getTopics()
      .then((list) => {
        if (!cancelled) setTopics(list);
      })
      .catch((err) => {
        console.error('[HomeView] Failed to load topics:', err);
      });

    // Sync metadata isn't on the plain Topic, so the published set comes from
    // the records endpoint. Refetched on every topic change — publishing
    // fires TOPIC_UPDATED, and remoteId only appears on a reread.
    const refreshPublishedIds = () => {
      TopicService.getRecords()
        .then((records) => {
          if (cancelled) return;
          setPublishedTopicIds(
            new Set(
              records.filter((r) => r.sync.remoteId).map((r) => r.topic.id),
            ),
          );
        })
        .catch((err) => {
          console.error('[HomeView] Failed to load topic records:', err);
        });
    };
    refreshPublishedIds();

    const unsubscribe = TopicService.onTopicChange((event) => {
      refreshPublishedIds();
      if (event.type === 'added' && event.topic) {
        const topic = event.topic;
        setTopics((prev) =>
          prev.some((t) => t.id === topic.id) ? prev : [...prev, topic],
        );
      } else if (event.type === 'updated' && event.topic) {
        const topic = event.topic;
        setTopics((prev) => prev.map((t) => (t.id === topic.id ? topic : t)));
      } else if (event.type === 'removed' && event.id) {
        const id = event.id;
        setTopics((prev) => prev.filter((t) => t.id !== id));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const dashboardTopicEntries = useMemo<TopicsDashboardTopicEntry[]>(() => {
    const sorted = [...topics].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return sorted.map((t) => {
      return {
        key: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
        published: publishedTopicIds.has(t.id),
        status: t.status,
      };
    });
  }, [
    topics,
    publishedTopicIds,
  ]);

  // Show the dashboard once the user has any content to land on — a topic, an
  // open project, or trails. Otherwise fall back to the prompt-idea cards.
  const hasDashboardContent =
    topics.length > 0 || openProjects.length > 0 || recentTrails.length > 0;

  const installedSkillDetails = useMemo(
    () => ALL_SKILL_DETAILS.filter((s) => installedSkillNames.has(s.name)),
    [installedSkillNames],
  );

  // Optional skills not yet installed — shown as install buttons in the footer.
  const optionalSkillsToInstall = useMemo(
    () =>
      OPTIONAL_SKILL_DETAILS.filter((s) => !installedSkillNames.has(s.name)),
    [installedSkillNames],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lockFile = await SkillLockService.getLockFile();
        if (!cancelled) {
          const installed = matchInstalledFromLock(lockFile);
          setInstalledSkillNames(installed);
          // The trail dashboard gates on the required bundle only.
          setSkillInstalled(
            TRAIL_INSTALL_SKILL_NAMES.every((name) => installed.has(name)),
          );
        }
      } catch (error) {
        console.error('[HomeView] Failed to load skill state:', error);
        if (!cancelled) setSkillInstalled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Checks installed trail skills for available updates by comparing each
  // skill's on-disk files against the source's current blobs (CHECK_SKILL_UPDATES).
  // Populates the set of skill names with updates.
  const refreshSkillUpdates = useCallback(async () => {
    try {
      const tracked = new Set<string>(TRACKED_SKILL_NAMES);
      const updates = await SkillLockService.checkUpdates();
      setSkillUpdates(
        new Set(
          updates
            .filter((u) => u.hasUpdate && tracked.has(u.name))
            .map((u) => u.name),
        ),
      );
    } catch (error) {
      console.error('[HomeView] Failed to check skill updates:', error);
    }
  }, []);

  useEffect(() => {
    void refreshSkillUpdates();
  }, [refreshSkillUpdates]);

  useEffect(() => {
    const tracked = new Set<string>(TRACKED_SKILL_NAMES);
    const recheck = async () => {
      try {
        const lockFile = await SkillLockService.getLockFile();
        const installed = matchInstalledFromLock(lockFile);
        setInstalledSkillNames(installed);
        setSkillInstalled(
          TRAIL_INSTALL_SKILL_NAMES.every((name) => installed.has(name)),
        );
        void refreshSkillUpdates();
      } catch (error) {
        console.error('[HomeView] Failed to refresh skill state:', error);
      }
    };
    const offInstalled = SkillLockService.onSkillInstalled((payload) => {
      if (tracked.has(payload.skillName)) void recheck();
    });
    const offUninstalled = SkillLockService.onSkillUninstalled((payload) => {
      if (tracked.has(payload.skillName)) void recheck();
    });
    const offUpdated = SkillLockService.onSkillUpdated((payload) => {
      if (tracked.has(payload.skillName)) void recheck();
    });
    return () => {
      offInstalled();
      offUninstalled();
      offUpdated();
    };
  }, [refreshSkillUpdates]);

  // Fetch the skills repo tree once and install each named skill into both the
  // canonical and Claude-specific skill directories. Returns the set of skills
  // that installed at least once, plus any per-destination failures.
  const installSkillsByName = useCallback(
    async (
      names: ReadonlyArray<string>,
    ): Promise<{ fullyInstalled: Set<string>; failures: string[] }> => {
      const treeResult = await GithubService.getTree(
        TRAIL_SKILL_REPO_OWNER,
        TRAIL_SKILL_REPO_NAME,
        TRAIL_SKILL_BRANCH,
      );
      if (!treeResult?.success || !treeResult.data) {
        throw new Error('Could not fetch skills repository tree.');
      }

      const tree = treeResult.data.tree;
      const destinations = [
        DIRECTORY_ID_TO_DESTINATION['claude-specific'],
        DIRECTORY_ID_TO_DESTINATION['agent-universal'],
      ] as const;

      const failures: string[] = [];
      const fullyInstalled = new Set<string>();

      for (const skillName of names) {
        const prefix = `${skillName}/`;
        const fileList = tree
          .filter(
            (item) => item.type === 'blob' && item.path.startsWith(prefix),
          )
          .map((item) => item.path);
        if (fileList.length === 0) {
          failures.push(`${skillName}: not found in repo`);
          continue;
        }
        const folderEntry = tree.find(
          (item) => item.type === 'tree' && item.path === skillName,
        );

        let skillSucceededOnce = false;
        for (const destination of destinations) {
          const result = await GithubService.installSkill({
            githubUrl: TRAIL_SKILL_GITHUB_URL,
            skillPath: skillName,
            destination,
            skillName,
            fileList,
            skillTreeSha: folderEntry?.sha,
          });
          if (result.success) {
            skillSucceededOnce = true;
          } else {
            failures.push(
              `${skillName} → ${destination}: ${result.error || 'failed'}`,
            );
          }
        }
        if (skillSucceededOnce) {
          fullyInstalled.add(skillName);
        }
      }

      return { fullyInstalled, failures };
    },
    [],
  );

  // Update re-runs the install path so the skill's files are actually
  // re-downloaded. The old updateSingleSkill only advanced the lock hash,
  // leaving the on-disk files stale while clearing the update badge.
  const handleUpdateSkill = useCallback(
    async (name: string) => {
      setUpdatingSkills((prev) => new Set(prev).add(name));
      try {
        const { fullyInstalled, failures } = await installSkillsByName([name]);
        if (!fullyInstalled.has(name)) {
          throw new Error(
            failures.length > 0
              ? failures.join('; ')
              : `Failed to update ${name}.`,
          );
        }
        // INSTALL_SKILL's skill:installed broadcast drives recheck(), which
        // refreshes the update flags. Clear optimistically as a fallback.
        setSkillUpdates((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      } catch (error) {
        console.error('[HomeView] Failed to update skill:', name, error);
      } finally {
        setUpdatingSkills((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [installSkillsByName],
  );

  const handleInstallSkill = useCallback(async () => {
    setInstallingSkill(true);
    setSkillInstallError(null);
    try {
      const { fullyInstalled, failures } = await installSkillsByName(
        TRAIL_INSTALL_SKILL_NAMES,
      );
      if (fullyInstalled.size === 0) {
        throw new Error(
          failures.length > 0
            ? failures.join('; ')
            : 'Failed to install trail skills.',
        );
      }
      const allInstalled = TRAIL_INSTALL_SKILL_NAMES.every((name) =>
        fullyInstalled.has(name),
      );
      setSkillInstalled(allInstalled);
      if (failures.length > 0) {
        setSkillInstallError(`Partial install: ${failures.join('; ')}`);
      }
    } catch (error) {
      console.error('[HomeView] Skill install failed:', error);
      setSkillInstallError(
        error instanceof Error ? error.message : 'Install failed.',
      );
    } finally {
      setInstallingSkill(false);
    }
  }, [installSkillsByName]);

  // Install a single optional skill on demand. The skill:installed broadcast
  // drives recheck(), which moves it from the install row into the installed
  // badges; we update local state optimistically as a fallback.
  const handleInstallOptionalSkill = useCallback(
    async (name: string) => {
      setInstallingOptional((prev) => new Set(prev).add(name));
      setSkillInstallError(null);
      try {
        const { fullyInstalled, failures } = await installSkillsByName([name]);
        if (!fullyInstalled.has(name)) {
          throw new Error(
            failures.length > 0
              ? failures.join('; ')
              : `Failed to install ${name}.`,
          );
        }
        setInstalledSkillNames((prev) => new Set(prev).add(name));
      } catch (error) {
        console.error('[HomeView] Optional skill install failed:', error);
        setSkillInstallError(
          error instanceof Error ? error.message : 'Install failed.',
        );
      } finally {
        setInstallingOptional((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [installSkillsByName],
  );

  // Small uppercase eyebrow shared by the right-rail section headings.
  const railHeadingStyle: React.CSSProperties = {
    fontFamily: theme.fonts.body,
    fontSize: theme.fontSizes[0],
    fontWeight: theme.fontWeights.semibold,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: theme.colors.textSecondary,
  };

  // The installed-skill + installable-add-on badges. Rendered in the right rail
  // (the normal home state, `rail`) and as a centered bottom footer (the
  // pre-install welcome state).
  const installedSkillsBlock = (rail: boolean): React.ReactNode => {
    if (installedSkillDetails.length === 0) return null;
    return (
      <div
        style={
          rail
            ? {
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }
            : {
                flex: '0 0 auto',
                marginTop: 'auto',
                paddingTop: 32,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }
        }
      >
        <div style={railHeadingStyle}>Suggested Skills</div>
        <div
          style={{
            display: 'flex',
            flexDirection: rail ? 'column' : 'row',
            alignItems: rail ? 'stretch' : undefined,
            justifyContent: rail ? 'flex-start' : 'center',
            gap: 10,
            flexWrap: 'wrap',
            maxWidth: rail ? undefined : 900,
          }}
        >
          {installedSkillDetails.map((skill) => {
            const SkillIcon = skill.Icon;
            const hasUpdate = skillUpdates.has(skill.name);
            const isUpdating = updatingSkills.has(skill.name);
            const accent = hasUpdate
              ? theme.colors.warning
              : theme.colors.border;
            return (
              <button
                key={skill.name}
                type="button"
                disabled={isUpdating}
                onClick={() => {
                  if (isUpdating) return;
                  if (hasUpdate) {
                    void handleUpdateSkill(skill.name);
                  } else {
                    void ShellService.openExternal(skill.url);
                  }
                }}
                title={
                  isUpdating
                    ? `Updating ${skill.title}…`
                    : hasUpdate
                      ? `Update available for ${skill.title} — click to update`
                      : `${skill.title} is installed — open on GitHub`
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: rail ? '100%' : undefined,
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: `1px solid ${accent}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: isUpdating ? 'default' : 'pointer',
                  opacity: isUpdating ? 0.7 : 1,
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = hasUpdate
                    ? theme.colors.warning
                    : theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = accent;
                }}
              >
                <SkillIcon size={16} color={theme.colors.primary} />
                <span style={{ fontWeight: theme.fontWeights.medium }}>
                  {skill.title}
                </span>
                {hasUpdate || isUpdating ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginLeft: rail ? 'auto' : undefined,
                      color: theme.colors.warning,
                      fontWeight: theme.fontWeights.medium,
                    }}
                  >
                    <RefreshCw size={14} />
                    {isUpdating ? 'Updating…' : 'Update'}
                  </span>
                ) : (
                  <Check
                    size={14}
                    color={theme.colors.success ?? theme.colors.primary}
                    style={{ marginLeft: rail ? 'auto' : undefined }}
                  />
                )}
              </button>
            );
          })}
          {optionalSkillsToInstall.map((skill) => {
            const SkillIcon = skill.Icon;
            const isInstalling = installingOptional.has(skill.name);
            return (
              <button
                key={skill.name}
                type="button"
                disabled={isInstalling}
                onClick={() => {
                  if (isInstalling) return;
                  void handleInstallOptionalSkill(skill.name);
                }}
                title={
                  isInstalling
                    ? `Installing ${skill.title}…`
                    : `${skill.description} — click to install`
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: rail ? '100%' : undefined,
                  padding: '8px 12px',
                  borderRadius: 12,
                  // Dashed border marks an installable add-on, distinct from
                  // the solid-bordered installed badges.
                  border: `1px dashed ${theme.colors.primary}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  cursor: isInstalling ? 'default' : 'pointer',
                  opacity: isInstalling ? 0.7 : 1,
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
              >
                <SkillIcon size={16} color={theme.colors.primary} />
                <span style={{ fontWeight: theme.fontWeights.medium }}>
                  {skill.title}
                </span>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginLeft: rail ? 'auto' : undefined,
                    color: theme.colors.primary,
                    fontWeight: theme.fontWeights.medium,
                  }}
                >
                  {isInstalling ? (
                    <RefreshCw size={14} />
                  ) : (
                    <Download size={14} />
                  )}
                  {isInstalling ? 'Installing…' : 'Install'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const welcomeHeader = (
    <div style={{ textAlign: 'center', maxWidth: 640 }}>
      <div
        style={{
          color: theme.colors.text,
          fontFamily: theme.fonts.heading ?? theme.fonts.body,
          fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: theme.fontWeights.bold,
          letterSpacing: '-0.02em',
          lineHeight: 1.05,
          marginBottom: 12,
        }}
      >
        <div>
          Welcome{' '}
          <button
            type="button"
            onClick={() => setGitConfigOpen(true)}
            title={
              gitUserName
                ? 'This name comes from your global git config (user.name). Click to view or edit.'
                : 'No global git identity is configured. Click to set one.'
            }
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              color: theme.colors.primary,
              font: 'inherit',
              fontStyle: gitUserName ? 'normal' : 'italic',
              letterSpacing: 'inherit',
              lineHeight: 'inherit',
              cursor: 'pointer',
              transition: 'color 150ms ease, opacity 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onFocus={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onBlur={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {gitUserName ?? 'stranger'}
          </button>
        </div>
        <div>to</div>
        <div style={{ color: theme.colors.text }}>
          Principal <span style={{ color: theme.colors.primary }}>AI</span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          backgroundColor: theme.colors.background,
          padding: 32,
          overflowY: 'auto',
        }}
      >
        {skillInstalled === false && (
          <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>
            {welcomeHeader}
          </div>
        )}

        {skillInstalled === false && (
          <div
            style={{
              flex: '0 0 auto',
              marginTop: 40,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              width: '100%',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <button
                onClick={() => void handleInstallSkill()}
                disabled={installingSkill}
                title="Installs the trail skills (convert-investigation, author-investigation-trail, author-informative-trail, topic-context) to ~/.claude/skills and ~/.agents/skills. Cursor and Windsurf also read skills from ~/.agents/skills."
                style={{
                  width: 360,
                  padding: 36,
                  borderRadius: 12,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  cursor: installingSkill ? 'default' : 'pointer',
                  opacity: installingSkill ? 0.7 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'center',
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (installingSkill) return;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <Footprints size={36} color={theme.colors.primary} />
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                  }}
                >
                  {installingSkill ? 'Installing…' : 'Install Trail Skills'}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSkillDetails((prev) => !prev)}
              aria-expanded={showSkillDetails}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: theme.colors.primary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'underline',
              }}
            >
              What skills
            </button>

            {showSkillDetails && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  width: '100%',
                  maxWidth: 1080,
                }}
              >
                {TRAIL_SKILL_DETAILS.map((skill) => {
                  const SkillIcon = skill.Icon;
                  return (
                    <button
                      key={skill.name}
                      type="button"
                      onClick={() => void ShellService.openExternal(skill.url)}
                      title={`Open ${skill.name} on GitHub`}
                      style={{
                        flex: '1 1 240px',
                        maxWidth: 320,
                        minWidth: 220,
                        padding: 20,
                        borderRadius: 12,
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.backgroundSecondary,
                        color: theme.colors.text,
                        fontFamily: theme.fonts.body,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 8,
                        textAlign: 'left',
                        transition: 'border-color 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor =
                          theme.colors.primary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = theme.colors.border;
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <SkillIcon size={20} color={theme.colors.primary} />
                        <ExternalLink
                          size={12}
                          color={theme.colors.textSecondary}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[2],
                          fontWeight: theme.fontWeights.semibold,
                        }}
                      >
                        {skill.title}
                      </div>
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          lineHeight: 1.4,
                        }}
                      >
                        {skill.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {skillInstallError && (
              <div
                style={{
                  color: theme.colors.error ?? theme.colors.primary,
                  fontFamily: theme.fonts.body,
                  fontSize: theme.fontSizes[1],
                  maxWidth: 520,
                  textAlign: 'center',
                }}
              >
                {skillInstallError}
              </div>
            )}
          </div>
        )}

        {skillInstalled === true && (
          <div
            style={{
              display: 'grid',
              // Symmetric 3 columns: an empty left spacer the same width as the
              // rail, the topics in the middle, and the rail on the right — so
              // the topics column is centered on the page. The center track uses
              // minmax(0, 1fr) so it can shrink and scroll its list internally.
              gridTemplateColumns: '300px minmax(0, 1fr) 300px',
              columnGap: 32,
              width: '100%',
              marginTop: 24,
              alignItems: 'stretch',
              flex: '1 1 auto',
              minHeight: 0,
            }}
          >
            {/* Left rail: installed skills. Falls back to an empty spacer so
                the topics column stays centered when there are no skills. */}
            {installedSkillDetails.length > 0 ? (
              <aside
                style={{
                  // Width comes from the grid's 300px left track.
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 28,
                  // Align the rail's first heading with the dashboard's
                  // section heading (its section has a 40px top padding).
                  paddingTop: 40,
                  // Scroll the rail's own overflow rather than the page.
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                {installedSkillsBlock(true)}
              </aside>
            ) : (
              <div aria-hidden />
            )}

            {/* Center column: the prioritized topics dashboard (or the prompt
                ideas for a brand-new user with nothing to land on yet). */}
            <div
              style={{
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {hasDashboardContent ? (
                <TopicsDashboard
                  topicEntries={dashboardTopicEntries}
                  onSelectTopic={(entry) =>
                    openTopicInTopicsView(entry.key, entry.title)
                  }
                  onCreateTopic={() => setIsNewTopicOpen(true)}
                  onDeleteTopic={(entry) => setPendingDeleteTopic(entry)}
                />
              ) : (
                <TrailPromptIdeas />
              )}
            </div>

            {/* Right rail: open projects. Rendered only when there's
                something to put in it. */}
            {openProjects.length > 0 && (
              <aside
                style={{
                  // Width comes from the grid's 300px right track.
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 28,
                  // Align the rail's first heading with the dashboard's
                  // section heading (its section has a 40px top padding).
                  paddingTop: 40,
                  // Scroll the rail's own overflow rather than the page.
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={railHeadingStyle}>Open Projects</div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {openProjects.map((p) => (
                      <OpenProjectCard
                        key={p.key}
                        entry={p}
                        theme={theme}
                        onClick={() => void openProject(p.key)}
                      />
                    ))}
                  </div>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Pre-install welcome state keeps the skills as a centered bottom
            footer; once installed they move into the right rail above. */}
        {skillInstalled === false && installedSkillsBlock(false)}
      </div>

      <GitGlobalConfigModal
        isOpen={gitConfigOpen}
        onClose={() => {
          setGitConfigOpen(false);
          void loadGitUserName();
        }}
      />

      <NewTopicModal
        isOpen={isNewTopicOpen}
        onClose={() => setIsNewTopicOpen(false)}
      />

      {pendingDeleteTopic && (
        <DeleteTopicConfirmDialog
          topicTitle={pendingDeleteTopic.title}
          busy={deletingTopic}
          onCancel={() => {
            if (deletingTopic) return;
            setPendingDeleteTopic(null);
          }}
          onConfirm={() => {
            const target = pendingDeleteTopic;
            if (!target) return;
            setDeletingTopic(true);
            void (async () => {
              try {
                await TopicService.deleteTopic(target.key);
              } catch (err) {
                console.error('[HomeView] Failed to delete topic:', err);
              } finally {
                setDeletingTopic(false);
                setPendingDeleteTopic(null);
              }
            })();
          }}
        />
      )}
    </div>
  );
}
