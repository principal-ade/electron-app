import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import {
  BookOpen,
  Check,
  ExternalLink,
  Footprints,
  Layers,
  Search,
  Share2,
} from 'lucide-react';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { GithubService } from '../../../main-process-api/GithubService';
import { SkillLockService } from '../../../main-process-api/SkillLockService';
import { ShellService } from '../../../main-process-api/ShellService';
import { TopicService } from '../../../main-process-api/TopicService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import { WindowService } from '../../../main-process-api/WindowService';
import { WorkspaceService } from '../../../main-process-api/WorkspaceService';
import { TrailLibraryService } from '../../../services/TrailLibraryService';
import { GitGlobalConfigModal } from '../../../components/GitGlobalConfigModal';
import { NewTopicModal } from '../../../components/NewTopicModal';
import { DeleteTopicConfirmDialog } from '../../../components/DeleteTopicConfirmDialog';
import { TrailPromptIdeas } from '../../components/TrailPromptIdeas';
import { DIRECTORY_ID_TO_DESTINATION } from '../SkillBrowserView/InstallSkillToolbar';
import type { TrailIndexEntry } from '../../../../shared/main-process-api-interfaces/FileCityTrailAPI';
import type {
  AlexandriaEntry,
  Topic,
  Workspace,
} from '@principal-ai/alexandria-core-library/types';
import {
  TrailsDashboard,
  type TrailsDashboardRepoEntry,
  type TrailsDashboardTopicEntry,
} from '../TrailsView/TrailsDashboard';

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

const TRAIL_INSTALL_SKILL_NAMES = [
  'convert-investigation',
  'author-investigation-trail',
  'author-informative-trail',
  'topic-context',
] as const;

const TRAIL_SKILL_DETAILS: ReadonlyArray<{
  name: (typeof TRAIL_INSTALL_SKILL_NAMES)[number];
  title: string;
  description: string;
  url: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    name: 'author-investigation-trail',
    title: 'Author Investigation Trail',
    description:
      'Capture an investigation as you debug — records the files, calls, and findings you walked through so the chain of reasoning is preserved.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-investigation-trail`,
    Icon: Search,
  },
  {
    name: 'author-informative-trail',
    title: 'Author Informative Trail',
    description:
      'Lay a guided tour through the code to explain how a feature or system works, so a teammate can follow the path without reverse-engineering it.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/author-informative-trail`,
    Icon: BookOpen,
  },
  {
    name: 'convert-investigation',
    title: 'Convert Investigation',
    description:
      'Turn a raw investigation trail into a polished, shareable spec — cleans up the trail and forwards it through the convert pipeline.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/convert-investigation`,
    Icon: Share2,
  },
  {
    name: 'topic-context',
    title: 'Topic Context',
    description:
      'Read the topic an agent was briefed on and keep its description current — fetch the topic and its trails, append discovered context, or replace a status section in place.',
    url: `${TRAIL_SKILL_GITHUB_URL}/tree/${TRAIL_SKILL_BRANCH}/topic-context`,
    Icon: Layers,
  },
];

export function HomeView() {
  const { theme } = useTheme();

  const [gitUserName, setGitUserName] = useState<string | null>(null);
  const [gitConfigOpen, setGitConfigOpen] = useState(false);

  const loadGitUserName = useCallback(async () => {
    try {
      const result = await GitService.execCommand(
        process.env.HOME || '/',
        ['config', '--global', 'user.name'],
      );
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
  const [showSkillDetails, setShowSkillDetails] = useState(false);

  // Dashboard data sources. Mirrors what TrailsView used to load.
  const [recentTrails, setRecentTrails] = useState<TrailIndexEntry[]>([]);
  const [repositories, setRepositories] = useState<AlexandriaEntry[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  // Ids of topics published to web-ade (sync.remoteId present), from the
  // sync-aware records endpoint. Drives the "Shared" badge on topic cards.
  const [sharedTopicIds, setSharedTopicIds] = useState<Set<string>>(new Set());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceRepos, setWorkspaceRepos] = useState<
    Map<string, AlexandriaEntry[]>
  >(new Map());
  const [defaultBaseDirectory, setDefaultBaseDirectory] = useState<
    string | null
  >(null);

  // Topic modal state.
  const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
  const [pendingDeleteTopic, setPendingDeleteTopic] =
    useState<TrailsDashboardTopicEntry | null>(null);
  const [deletingTopic, setDeletingTopic] = useState(false);

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

    // Sync metadata isn't on the plain Topic, so the shared set comes from
    // the records endpoint. Refetched on every topic change — publishing
    // fires TOPIC_UPDATED, and remoteId only appears on a reread.
    const refreshSharedIds = () => {
      TopicService.getRecords()
        .then((records) => {
          if (cancelled) return;
          setSharedTopicIds(
            new Set(
              records
                .filter((r) => r.sync.remoteId)
                .map((r) => r.topic.id),
            ),
          );
        })
        .catch((err) => {
          console.error('[HomeView] Failed to load topic records:', err);
        });
    };
    refreshSharedIds();

    const unsubscribe = TopicService.onTopicChange((event) => {
      refreshSharedIds();
      if (event.type === 'added' && event.topic) {
        const topic = event.topic;
        setTopics((prev) =>
          prev.some((t) => t.id === topic.id) ? prev : [...prev, topic],
        );
      } else if (event.type === 'updated' && event.topic) {
        const topic = event.topic;
        setTopics((prev) =>
          prev.map((t) => (t.id === topic.id ? topic : t)),
        );
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

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      WorkspaceService.getWorkspaces()
        .then((list) => {
          if (!cancelled) setWorkspaces(list);
        })
        .catch((err) => {
          console.error('[HomeView] Failed to load workspaces:', err);
        });
    };
    refresh();
    const unsubscribe = WorkspaceService.onWorkspaceChange(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const targetIds = workspaces
      .filter((w) => (w.topicIds?.length ?? 0) > 0)
      .map((w) => w.id);
    if (targetIds.length === 0) {
      setWorkspaceRepos((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    Promise.all(
      targetIds.map((id) =>
        WorkspaceService.getRepositoriesInWorkspace(id)
          .then((repos) => [id, repos] as const)
          .catch((err) => {
            console.error(
              '[HomeView] Failed to load repos for workspace',
              id,
              err,
            );
            return [id, [] as AlexandriaEntry[]] as const;
          }),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setWorkspaceRepos(new Map(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [workspaces]);

  useEffect(() => {
    let cancelled = false;
    UserPreferencesService.getPreferences()
      .then((prefs) => {
        if (!cancelled)
          setDefaultBaseDirectory(prefs.baseDefaultDirectory || null);
      })
      .catch(() => {});
    const unsubscribe = UserPreferencesService.onPreferencesUpdated((prefs) => {
      setDefaultBaseDirectory(prefs.baseDefaultDirectory || null);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const dashboardRepoEntries = useMemo<TrailsDashboardRepoEntry[]>(() => {
    const byRepo = new Map<
      string,
      { entry: TrailsDashboardRepoEntry; count: number }
    >();
    for (const trail of recentTrails) {
      if (!trail.repositoryPath) continue;
      const existing = byRepo.get(trail.repositoryPath);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const repo = repositories.find((r) => r.path === trail.repositoryPath);
      byRepo.set(trail.repositoryPath, {
        count: 1,
        entry: {
          key: trail.repositoryPath,
          label: trailRepoLabel(trail.repositoryPath),
          ownerLogin: repo?.github?.owner,
          trailCount: 1,
          latestTrail: trail,
        },
      });
    }
    return Array.from(byRepo.values()).map(({ entry, count }) => ({
      ...entry,
      trailCount: count,
    }));
  }, [recentTrails, repositories]);

  const dashboardTopicEntries = useMemo<TrailsDashboardTopicEntry[]>(() => {
    const sorted = [...topics].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
    return sorted.map((t) => {
      const workspace = workspaces.find((w) => w.topicIds?.includes(t.id));
      const repos = workspace ? (workspaceRepos.get(workspace.id) ?? []) : [];
      const projectRepos = repos.map((repo) => ({
        name: repo.github?.name ?? repo.name ?? trailRepoLabel(repo.path),
        ownerLogin: repo.github?.owner,
      }));
      return {
        key: t.id,
        title: t.title,
        updatedAt: t.updatedAt,
        folderPath:
          workspace?.suggestedClonePath ?? defaultBaseDirectory ?? undefined,
        projectRepos: projectRepos.length > 0 ? projectRepos : undefined,
        shared: sharedTopicIds.has(t.id),
        trailCount: t.trailIds.length,
      };
    });
  }, [topics, workspaces, workspaceRepos, defaultBaseDirectory, sharedTopicIds]);

  const hasAnyTrail = recentTrails.length > 0;

  const installedSkillDetails = useMemo(
    () => TRAIL_SKILL_DETAILS.filter((s) => installedSkillNames.has(s.name)),
    [installedSkillNames],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const checks = await Promise.all(
          TRAIL_INSTALL_SKILL_NAMES.map((name) =>
            SkillLockService.isSkillInstalled(name),
          ),
        );
        if (!cancelled) {
          setSkillInstalled(checks.every(Boolean));
          setInstalledSkillNames(
            new Set(TRAIL_INSTALL_SKILL_NAMES.filter((_, i) => checks[i])),
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

  useEffect(() => {
    const tracked = new Set<string>(TRAIL_INSTALL_SKILL_NAMES);
    const recheck = async () => {
      try {
        const checks = await Promise.all(
          TRAIL_INSTALL_SKILL_NAMES.map((name) =>
            SkillLockService.isSkillInstalled(name),
          ),
        );
        setSkillInstalled(checks.every(Boolean));
        setInstalledSkillNames(
          new Set(TRAIL_INSTALL_SKILL_NAMES.filter((_, i) => checks[i])),
        );
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
    return () => {
      offInstalled();
      offUninstalled();
    };
  }, []);

  const handleInstallSkill = useCallback(async () => {
    setInstallingSkill(true);
    setSkillInstallError(null);
    try {
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

      for (const skillName of TRAIL_INSTALL_SKILL_NAMES) {
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
  }, []);

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
                ? "This name comes from your global git config (user.name). Click to view or edit."
                : "No global git identity is configured. Click to set one."
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
                        e.currentTarget.style.borderColor = theme.colors.primary;
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

        {skillInstalled === true && hasAnyTrail && (
          <div style={{ flex: '0 0 auto', width: '100%', marginTop: 24 }}>
            <TrailsDashboard
              repoEntries={dashboardRepoEntries}
              recentTrails={recentTrails}
              topicEntries={dashboardTopicEntries}
              onSelectRepo={(entry) => {
                window.dispatchEvent(
                  new CustomEvent('home:open-in-trails', {
                    detail: { repoPath: entry.key },
                  }),
                );
              }}
              onSelectTopic={(entry) => {
                const target = workspaces.find((w) =>
                  w.topicIds?.includes(entry.key),
                );
                if (!target) {
                  console.warn(
                    '[HomeView] No workspace found for topic:',
                    entry.key,
                  );
                  return;
                }
                void WindowService.openAlexandriaWorkspace({
                  workspaceId: target.id,
                }).catch((err) => {
                  console.error(
                    '[HomeView] Failed to open topic workspace:',
                    err,
                  );
                });
              }}
              onCreateTopic={() => setIsNewTopicOpen(true)}
              onDeleteTopic={(entry) => setPendingDeleteTopic(entry)}
              onViewAllProjects={() =>
                window.dispatchEvent(
                  new CustomEvent('home:open-in-trails', { detail: {} }),
                )
              }
            />
          </div>
        )}

        {skillInstalled === true && !hasAnyTrail && <TrailPromptIdeas />}

        {installedSkillDetails.length > 0 && (
          <div
            style={{
              flex: '0 0 auto',
              marginTop: 'auto',
              paddingTop: 32,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                fontFamily: theme.fonts.body,
                fontSize: theme.fontSizes[0],
                fontWeight: theme.fontWeights.semibold,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: theme.colors.textSecondary,
              }}
            >
              Installed Skills
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 10,
                flexWrap: 'wrap',
                maxWidth: 900,
              }}
            >
              {installedSkillDetails.map((skill) => {
                const SkillIcon = skill.Icon;
                return (
                  <button
                    key={skill.name}
                    type="button"
                    onClick={() => void ShellService.openExternal(skill.url)}
                    title={`${skill.title} is installed — open on GitHub`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderRadius: 999,
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: theme.colors.backgroundSecondary,
                      color: theme.colors.text,
                      fontFamily: theme.fonts.body,
                      fontSize: theme.fontSizes[1],
                      cursor: 'pointer',
                      transition: 'border-color 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.primary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = theme.colors.border;
                    }}
                  >
                    <SkillIcon size={16} color={theme.colors.primary} />
                    <span style={{ fontWeight: theme.fontWeights.medium }}>
                      {skill.title}
                    </span>
                    <Check
                      size={14}
                      color={theme.colors.success ?? theme.colors.primary}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
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
          workspaceFolderPath={pendingDeleteTopic.folderPath}
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
                const linked = workspaces.filter((w) =>
                  w.topicIds?.includes(target.key),
                );
                await Promise.all(
                  linked.map((w) =>
                    WorkspaceService.deleteWorkspace(w.id).catch((err) => {
                      console.error(
                        '[HomeView] Failed to delete workspace for topic:',
                        target.key,
                        err,
                      );
                    }),
                  ),
                );
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
