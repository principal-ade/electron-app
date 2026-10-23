import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  Boxes,
  Check,
  Compass,
  Download,
  ExternalLink,
  PenTool,
  Plug,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { TopicsIcon } from '../../../components/TopicsIcon';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { GithubService } from '../../../main-process-api/GithubService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { ShellService } from '../../../main-process-api/ShellService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';
import type { SkillLockFile } from '../../../../shared/main-process-api-interfaces/SkillLockAPI';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { SkyRepositoriesPanel } from './SkyRepositoriesPanel';
import { createInProgressActivityPanelActions } from '../../../panels/inProgressActivityPanelActions';
import { useAuthUser } from '../../../providers/AuthProvider';
import { PORTAL_INTENTS } from '../../../events/portalIntents';
import { usePortalEvents } from '../../PortalEventContext';
import { getPrincipalBridgeUrl } from '../../../../shared/config/appBranding';

interface HomeViewProps {
  /**
   * Dismiss the overlay this view lives in. The card grid opens repo/owner
   * profile tabs, which render in the portal *behind* the overlay, so the
   * overlay has to come down for the user to see what opened. Dismissing is not
   * navigation — the surface underneath, and its left panel, are untouched.
   */
  onDismissOverlay?: () => void;
}

/**
 * A public GitHub repo that hosts one or more advertised skills. Most ship from
 * the shared principal-ai/skills repo, but a skill may live in the repo that
 * owns it (e.g. create-subsystem-model in principal-ai/subsystem-modeling).
 */
interface SkillRepo {
  owner: string;
  name: string;
  branch: string;
}

const SKILLS_REPO: SkillRepo = {
  owner: 'principal-ai',
  name: 'skills',
  branch: 'main',
};
const SUBSYSTEM_MODELING_REPO: SkillRepo = {
  owner: 'principal-ai',
  name: 'subsystem-modeling',
  branch: 'main',
};

const TOPIC_SKILL_SETUP_SKIPPED_KEY = 'principal.topic-skill-setup-skipped';

function skillRepoUrl(repo: SkillRepo): string {
  return `https://github.com/${repo.owner}/${repo.name}`;
}

// Normalized "owner/repo" source recorded in the skill lock file. Used to
// confirm an installed skill came from the expected repo, not just that *some*
// skill of the same name is present — see matchInstalledFromLock.
function skillRepoSource(repo: SkillRepo): string {
  return `${repo.owner}/${repo.name}`;
}

/** Subset of GitHub's tree entries the install flow needs. */
type GitHubTreeEntry = {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
};

/** GitHub tree URL for the skill's folder, opened by clicking an installed badge. */
function skillFolderUrl(skill: { repo: SkillRepo; path: string }): string {
  return `${skillRepoUrl(skill.repo)}/tree/${skill.repo.branch}/${skill.path}`;
}

/** Display metadata shared by required and optional skill entries. */
interface SkillDetail {
  name: string;
  title: string;
  description: string;
  /** GitHub tree URL for the skill folder. */
  url: string;
  /**
   * Repo the skill ships from. Its "owner/repo" is the lock file `source`: a
   * lock entry only counts as *this* skill when the recorded source matches —
   * the lock file keys by bare name, so a same-named skill from another repo
   * would otherwise read as installed. See matchInstalledFromLock.
   */
  repo: SkillRepo;
  /** Path to the skill folder inside `repo` (nested for monorepo layouts). */
  path: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}

/** Catalog entry input — the folder URL is derived from the repo and path. */
function defineSkill(skill: Omit<SkillDetail, 'url'>): SkillDetail {
  return { ...skill, url: skillFolderUrl(skill) };
}

const TOPIC_SKILL_NAMES = ['create-topic', 'topic-context'] as const;

const TOPIC_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  defineSkill({
    name: 'create-topic',
    title: 'Create Topic',
    description:
      'Create a topic — a subject brief scoped to its declared projects, with a description that doubles as the working brief for agents pointed at it.',
    repo: SKILLS_REPO,
    path: 'create-topic',
    Icon: Plus,
  }),
  defineSkill({
    name: 'topic-context',
    title: 'Topic Context',
    description:
      'Read the topic an agent was briefed on and keep its description current — fetch the topic, append discovered context, or replace a status section in place.',
    repo: SKILLS_REPO,
    path: 'topic-context',
    Icon: TopicsIcon,
  }),
];

// Optional skills are installed individually. They
// surface in the footer as individually installable add-ons, and show up among
// the "Installed Skills" badges once present.
const OPTIONAL_SKILL_NAMES = [
  'excalidraw-drawings',
  'principal-ai-desktop-app-tools',
  'file-city-tours',
  'create-subsystem-model',
] as const;

const OPTIONAL_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  defineSkill({
    name: 'excalidraw-drawings',
    title: 'Excalidraw Drawings',
    description:
      "Find and edit the app's Excalidraw drawings on disk — locate the .excalidraw JSON under ~/.alexandria/drawings and edit a diagram directly so an agent can collaborate on it.",
    repo: SKILLS_REPO,
    path: 'excalidraw-drawings',
    Icon: PenTool,
  }),
  defineSkill({
    name: 'principal-ai-desktop-app-tools',
    title: 'Principal Desktop App Tools',
    description: `Canonical reference for the app's local bridge — the HTTP surface at ${getPrincipalBridgeUrl()} that agents use to create topics and leave notes on documents, plus the conventions every call shares.`,
    repo: SKILLS_REPO,
    path: 'principal-ai-desktop-app-tools',
    Icon: Plug,
  }),
  defineSkill({
    name: 'file-city-tours',
    title: 'File City Tours',
    description:
      "Create and validate guided introduction tours for File City visualizations — build onboarding walkthroughs that highlight a codebase's architecture with interactive highlights, actions, and color modes.",
    repo: SKILLS_REPO,
    path: 'file-city-tours',
    Icon: Compass,
  }),
  defineSkill({
    name: 'create-subsystem-model',
    title: 'Subsystem Models',
    description:
      'Author a subsystem model — named components, package/module containment, and runtime trails for one subsystem — then create it and open it in Subsystems Studio via the Principal Studio CLI.',
    // Ships from the subsystem-modeling repo, which owns the skill.
    repo: SUBSYSTEM_MODELING_REPO,
    path: 'skills/create-subsystem-model',
    Icon: Boxes,
  }),
];

/** Every skill the home view knows how to display or install. */
const ALL_SKILL_DETAILS: ReadonlyArray<SkillDetail> = [
  ...TOPIC_SKILL_DETAILS,
  ...OPTIONAL_SKILL_DETAILS,
];

/** Names whose install state the home view tracks (required + optional). */
const TRACKED_SKILL_NAMES: ReadonlyArray<string> = [
  ...TOPIC_SKILL_NAMES,
  ...OPTIONAL_SKILL_NAMES,
];

/**
 * Resolve which tracked skills are installed *from the repo we advertise*.
 *
 * The lock file keys entries by bare skill name, so presence-of-key alone can't
 * tell our `file-city-tours` (principal-ai/skills) apart from a same-named skill
 * installed from somewhere else (e.g. a stale principal-ai/file-city install). We
 * additionally
 * require the recorded `entry.source` to equal the catalog entry's source, so
 * the badge reflects *our* skill rather than any skill that happens to share the
 * name. Identity here is (name, source), even though storage still keys by name.
 */
function matchInstalledFromLock(lockFile: SkillLockFile | null): Set<string> {
  if (!lockFile) return new Set();
  return new Set(
    ALL_SKILL_DETAILS.filter((skill) => {
      const entry = lockFile.skills[skill.name];
      return entry != null && entry.source === skillRepoSource(skill.repo);
    }).map((skill) => skill.name),
  );
}

export function HomeView({ onDismissOverlay }: HomeViewProps) {
  const { theme } = useTheme();
  const { events: portalEvents } = usePortalEvents();
  const { user } = useAuthUser();

  // In-progress cards attribute unpushed commits to the viewer; feed the shared
  // identity in rather than letting the action module refetch the current user.
  const inProgressActions = useMemo(
    () =>
      createInProgressActivityPanelActions(
        user ? { login: user.login, avatarUrl: user.avatarUrl ?? '' } : null,
      ),
    [user],
  );

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

  const [topicSkillsInstalled, setTopicSkillsInstalled] = useState<
    boolean | null
  >(null);
  const [topicSkillSetupSkipped, setTopicSkillSetupSkipped] = useState(() => {
    try {
      return (
        window.localStorage.getItem(TOPIC_SKILL_SETUP_SKIPPED_KEY) === 'true'
      );
    } catch {
      return false;
    }
  });
  const [installedSkillNames, setInstalledSkillNames] = useState<Set<string>>(
    new Set(),
  );
  const [installingTopicSkills, setInstallingTopicSkills] = useState(false);
  const [skillInstallError, setSkillInstallError] = useState<string | null>(
    null,
  );
  // Optional skills currently being installed, by name (independent of the
  // required-bundle install above).
  const [installingOptional, setInstallingOptional] = useState<Set<string>>(
    new Set(),
  );
  const [showTopicSkillDetails, setShowTopicSkillDetails] = useState(false);
  const [skillUpdates, setSkillUpdates] = useState<Set<string>>(new Set());
  const [updatingSkills, setUpdatingSkills] = useState<Set<string>>(new Set());

  // Repositories tracked by Alexandria — the In Progress grid's data source.
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);

  // The card grid emits `repository:selected` / `owner:selected`; PortalIntentBridge
  // turns those into tabs in the portal behind this overlay. Dropping the
  // overlay on the same click is what makes the opened tab visible.
  useEffect(() => {
    const leave = () => onDismissOverlay?.();
    const offRepository = portalEvents.on(
      PORTAL_INTENTS.repositorySelected,
      leave,
    );
    const offOwner = portalEvents.on(PORTAL_INTENTS.ownerSelected, leave);
    return () => {
      offRepository();
      offOwner();
    };
  }, [portalEvents, onDismissOverlay]);

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

  const installedSkillDetails = useMemo(
    () => ALL_SKILL_DETAILS.filter((s) => installedSkillNames.has(s.name)),
    [installedSkillNames],
  );

  // Optional skills not yet installed — shown as install buttons alongside the
  // installed badges, whether or not anything is installed yet.
  const optionalSkillsToInstall = useMemo(
    () =>
      OPTIONAL_SKILL_DETAILS.filter((s) => !installedSkillNames.has(s.name)),
    [installedSkillNames],
  );
  // First-run moment: the greeting + skill install. It no longer gates the
  // dashboard — In Progress shows underneath it either way.
  const firstRun = topicSkillsInstalled === false && !topicSkillSetupSkipped;

  // Anything worth showing in the skills block — installed badges and/or the
  // optional add-ons still on offer. Add-ons keep the block alive before any
  // skill is installed, so a fresh user can still install one.
  const hasSkillEntries =
    installedSkillDetails.length > 0 || optionalSkillsToInstall.length > 0;
  // `topicSkillsInstalled` is null until the lock file has been read, so gate
  // the rail on it to keep the add-ons from flashing in during startup.
  const skillsStateLoaded = topicSkillsInstalled !== null;
  // The pre-install welcome state keeps the skills as a centered bottom footer;
  // everywhere else they live in the left rail. Once any skill is installed the
  // footer gives way to the rail (same as before).
  const showSkillsFooter = firstRun && installedSkillDetails.length === 0;
  const showSkillsRail =
    skillsStateLoaded && hasSkillEntries && !showSkillsFooter;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lockFile = await SkillLockService.getLockFile();
        if (!cancelled) {
          const installed = matchInstalledFromLock(lockFile);
          setInstalledSkillNames(installed);
          setTopicSkillsInstalled(
            TOPIC_SKILL_NAMES.every((name) => installed.has(name)),
          );
        }
      } catch (error) {
        console.error('[HomeView] Failed to load skill state:', error);
        if (!cancelled) setTopicSkillsInstalled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Checks installed tracked skills for available updates by comparing each
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
        setTopicSkillsInstalled(
          TOPIC_SKILL_NAMES.every((name) => installed.has(name)),
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

  // Fetch each source repo's tree once, then install the named skills into both
  // the canonical and Claude-specific skill directories. Returns the set of
  // skills that installed at least once, plus any per-destination failures.
  // Skills are grouped by repo so a bundle from one repo (the topic skills) is
  // still a single tree fetch, and a skill hosted elsewhere only fetches its own.
  const installSkillsByName = useCallback(
    async (
      names: ReadonlyArray<string>,
    ): Promise<{ fullyInstalled: Set<string>; failures: string[] }> => {
      const destinations = [
        DIRECTORY_ID_TO_DESTINATION['claude-specific'],
        DIRECTORY_ID_TO_DESTINATION['agent-universal'],
      ] as const;

      const failures: string[] = [];
      const fullyInstalled = new Set<string>();

      // Resolve names against the catalog up front: install state and the
      // GitHub source both come from the entry, never from the bare name.
      const byRepo = new Map<
        string,
        { repo: SkillRepo; skills: SkillDetail[] }
      >();
      for (const name of names) {
        const skill = ALL_SKILL_DETAILS.find((s) => s.name === name);
        if (!skill) {
          failures.push(`${name}: not in the skill catalog`);
          continue;
        }
        const key = skillRepoSource(skill.repo);
        const group = byRepo.get(key) ?? { repo: skill.repo, skills: [] };
        group.skills.push(skill);
        byRepo.set(key, group);
      }

      for (const { repo, skills } of byRepo.values()) {
        const githubUrl = skillRepoUrl(repo);
        let tree: GitHubTreeEntry[] = [];
        try {
          const treeResult = await GithubService.getTree(
            repo.owner,
            repo.name,
            repo.branch,
          );
          if (!treeResult?.success || !treeResult.data) {
            throw new Error(
              `Could not fetch the ${repo.owner}/${repo.name} repository tree.`,
            );
          }
          tree = treeResult.data.tree;
        } catch (error) {
          const reason =
            error instanceof Error ? error.message : 'tree fetch failed';
          for (const skill of skills) {
            failures.push(`${skill.name}: ${reason}`);
          }
          continue;
        }

        for (const skill of skills) {
          const prefix = `${skill.path}/`;
          const fileList = tree
            .filter(
              (item) => item.type === 'blob' && item.path.startsWith(prefix),
            )
            .map((item) => item.path);
          if (fileList.length === 0) {
            failures.push(
              `${skill.name}: not found at ${skill.path} in ${skillRepoSource(repo)}`,
            );
            continue;
          }
          const folderEntry = tree.find(
            (item) => item.type === 'tree' && item.path === skill.path,
          );

          let skillSucceededOnce = false;
          for (const destination of destinations) {
            const result = await GithubService.installSkill({
              githubUrl,
              skillPath: skill.path,
              destination,
              skillName: skill.name,
              fileList,
              skillTreeSha: folderEntry?.sha,
            });
            if (result.success) {
              skillSucceededOnce = true;
            } else {
              failures.push(
                `${skill.name} → ${destination}: ${result.error || 'failed'}`,
              );
            }
          }
          if (skillSucceededOnce) {
            fullyInstalled.add(skill.name);
          }
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

  const handleInstallTopicSkills = useCallback(async () => {
    setInstallingTopicSkills(true);
    setSkillInstallError(null);
    try {
      const { fullyInstalled, failures } =
        await installSkillsByName(TOPIC_SKILL_NAMES);
      if (fullyInstalled.size === 0) {
        throw new Error(
          failures.length > 0
            ? failures.join('; ')
            : 'Failed to install topic skills.',
        );
      }
      const allInstalled = TOPIC_SKILL_NAMES.every((name) =>
        fullyInstalled.has(name),
      );
      setTopicSkillsInstalled(allInstalled);
      if (failures.length > 0) {
        setSkillInstallError(`Partial install: ${failures.join('; ')}`);
      }
    } catch (error) {
      console.error('[HomeView] Skill install failed:', error);
      setSkillInstallError(
        error instanceof Error ? error.message : 'Install failed.',
      );
    } finally {
      setInstallingTopicSkills(false);
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

  // The installed-skill + installable-add-on badges. Rendered in the left rail
  // (the normal home state, `rail`) and as a centered bottom footer (the
  // pre-install welcome state). Add-ons show even before anything is installed.
  const installedSkillsBlock = (rail: boolean): React.ReactNode => {
    if (!hasSkillEntries) return null;
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
        {firstRun && (
          <div style={{ flex: '0 0 auto', marginTop: '9vh' }}>
            {welcomeHeader}
          </div>
        )}

        {firstRun && (
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
                onClick={() => void handleInstallTopicSkills()}
                disabled={installingTopicSkills}
                title="Installs the create-topic and topic-context skills to ~/.claude/skills and ~/.agents/skills. Cursor and Windsurf also read skills from ~/.agents/skills."
                style={{
                  width: 360,
                  padding: 36,
                  borderRadius: 12,
                  border: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.backgroundSecondary,
                  color: theme.colors.text,
                  fontFamily: theme.fonts.body,
                  cursor: installingTopicSkills ? 'default' : 'pointer',
                  opacity: installingTopicSkills ? 0.7 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'center',
                  transition: 'border-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (installingTopicSkills) return;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <TopicsIcon size={36} color={theme.colors.primary} />
                <div
                  style={{
                    fontSize: theme.fontSizes[3],
                    fontWeight: theme.fontWeights.semibold,
                  }}
                >
                  {installingTopicSkills
                    ? 'Installing…'
                    : 'Install Topic Skills'}
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.setItem(
                    TOPIC_SKILL_SETUP_SKIPPED_KEY,
                    'true',
                  );
                } catch {
                  // Keep the current-session choice even if storage is unavailable.
                }
                setTopicSkillSetupSkipped(true);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px 12px',
                color: theme.colors.textSecondary,
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[1],
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Continue without installing
            </button>

            <button
              type="button"
              onClick={() => setShowTopicSkillDetails((prev) => !prev)}
              aria-expanded={showTopicSkillDetails}
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

            {showTopicSkillDetails && (
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
                {TOPIC_SKILL_DETAILS.map((skill) => {
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

        {/* Sky View: the installed-skills rail beside the in-progress grid.
            Two tracks — a fixed rail plus the grid — so cards keep a readable
            width instead of stretching the full overlay. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '300px minmax(0, 1fr)',
            columnGap: 32,
            width: '100%',
            marginTop: firstRun ? 40 : 0,
            alignItems: 'stretch',
            flex: '1 1 auto',
            minHeight: 320,
          }}
        >
          {/* Left rail: installed skills plus the add-ons still on offer. Falls
              back to an empty spacer so the In Progress grid keeps its column
              width. */}
          {showSkillsRail ? (
            <aside
              style={{
                // Width comes from the grid's 300px track.
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                // Align the rail's first heading with the In Progress heading.
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

          {/* Center column: repositories with uncommitted or unpushed work. */}
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              // Matches the rail's heading offset so the two align.
              paddingTop: 40,
            }}
          >
            <SkyRepositoriesPanel
              headingStyle={railHeadingStyle}
              repositories={repositories}
              events={portalEvents}
              actions={inProgressActions}
            />
          </div>
        </div>

        {/* First-run keeps the skills as a centered bottom footer — including
            the add-ons, so nothing is hidden before a first install. Once any
            skill is installed they move into the left rail above. */}
        {showSkillsFooter && installedSkillsBlock(false)}
      </div>

      <GitGlobalConfigModal
        isOpen={gitConfigOpen}
        onClose={() => {
          setGitConfigOpen(false);
          void loadGitUserName();
        }}
      />
    </div>
  );
}
