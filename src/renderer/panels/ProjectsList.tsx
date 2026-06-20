/**
 * ProjectsList ("My Projects")
 *
 * A single, unified list of every project the user can reach: their local
 * clones plus every repository across their GitHub account and organizations.
 * Instead of separate views, the list is narrowed with single-select filter
 * chips (All / Cloned / In Progress). Within each org, cloned (on-disk)
 * projects sort first; the rest sort alphabetically by name, except under the
 * In Progress filter, where they order by most recent activity (the work
 * you're actively in). Orgs with more than 10 repos start collapsed.
 * Used in the ProjectsView left panel.
 */

import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Eraser, FolderGit2, FolderSearch, Loader2, Search } from 'lucide-react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { payloadFromGithub, payloadFromLocalEntry } from '../events/repositorySelected';
import type { GitStatusWithFiles } from '@principal-ai/repository-monitoring-server';
import { SegmentedControl } from '../components/SegmentedControl';
import { AlexandriaService } from '../main-process-api/AlexandriaService';
import { WorkspaceService } from '../main-process-api/WorkspaceService';
import { FileSystemService } from '../main-process-api/FileSystemService';
import { GitService } from '../main-process-api/GitService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import { UserPreferencesService } from '../main-process-api/UserPreferencesService';
import { useGithubProjects } from '../hooks/useGithubProjects';
import { OrgSectionHeaderCard } from './cards/OrgSectionHeaderCard';
import { OrgRepoItemCard } from './cards/OrgRepoItemCard';
import { RelocateToConventionModal } from './components/RelocateToConventionModal';
import { getOffConventionTarget } from '../../shared/utils/clonePath';
import { CloneFromGitHubModal } from './components/CloneFromGitHubModal';
import { CreateRepositoryInWorkspaceModal } from './components/CreateRepositoryInWorkspaceModal';

export interface CommitTimestamp {
  timestamp: Date | string;
  repoId?: string;
}

export interface ProjectsListProps {
  /** Commit timestamps (retained for API compatibility; not used by the list) */
  commits: CommitTimestamp[];
  /** Locally registered repositories (clones on disk) */
  repositories?: AlexandriaEntry[];
  /** Event emitter for panel communication */
  events: PanelEventEmitter;
  /** Currently selected time block (unused) */
  selectedBlock?: string | null;
}

/** Single-select filter applied to the unified list. */
type ProjectFilter = 'all' | 'cloned' | 'in-progress';

/** A merged project: a GitHub repo, a local clone, or both. */
interface UnifiedProject {
  key: string;
  owner: string;
  name: string;
  description?: string | null;
  isCloned: boolean;
  isDirty: boolean;
  /** Repository visibility: `true` private, `false` public, `undefined` unknown. */
  isPrivate?: boolean;
  /** The local registry entry, when cloned. */
  entry?: AlexandriaEntry;
  /** Epoch ms of the most recent activity, for the recency sort. */
  lastActivity: number;
  /** URL used to seed the clone flow, when known. */
  cloneUrl?: string;
  /**
   * Set when the local clone is under the base dir but not in the canonical
   * `{baseDir}/{owner}/{repo}` layout and a known owner is derivable. Drives the
   * off-convention row icon + relocate modal. `null`/absent = on convention or
   * not evaluable.
   */
  offConvention?: { expectedPath: string; owner: string } | null;
}

const toMs = (iso?: string): number => {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/** Local registry metadata tracks `isPublic`; invert to our `isPrivate`. */
const toIsPrivate = (isPublic?: boolean): boolean | undefined =>
  isPublic === undefined ? undefined : !isPublic;

export const ProjectsList: React.FC<ProjectsListProps> = ({
  repositories = [],
  events,
}) => {
  const { theme } = useTheme();

  const spacing = {
    xs: theme.space?.[1] || 4,
    sm: theme.space?.[2] || 8,
    md: theme.space?.[3] || 16,
  };

  // Filter + search state
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Git status map for local repositories
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, GitStatusWithFiles>>(new Map());

  // Collapsed state for org sections
  const [collapsedOrgs, setCollapsedOrgs] = useState<Set<string>>(new Set());
  // Orgs we've already applied the default-collapse rule to, so a user's
  // manual expand/collapse is never overridden on later re-renders.
  const defaultedOrgsRef = useRef<Set<string>>(new Set());

  // Clone-to-disk flow
  const [cloneUrl, setCloneUrl] = useState<string | null>(null);

  // Create-a-new-repo flow, scoped to a specific owner via the "+" on an
  // owner line. Repos land under `{baseDefaultDirectory}/{owner}/{name}`.
  const [createTarget, setCreateTarget] = useState<
    { owner: string; isUser: boolean } | null
  >(null);
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);

  // Folder-scan flow: pick a folder, find every git repo inside, and register
  // each one with Alexandria. The registry-change event refreshes the list.
  const [scanning, setScanning] = useState(false);

  // GitHub projects across the user's account + all their orgs
  const {
    repos: githubRepos,
    currentUser,
    userOrgs,
    loading: githubLoading,
  } = useGithubProjects();

  // Fetch git status for all repositories with local paths
  useEffect(() => {
    let cancelled = false;

    const fetchGitStatuses = async () => {
      const newStatusMap = new Map<string, GitStatusWithFiles>();

      await Promise.all(
        repositories
          .filter(repo => repo.path)
          .map(async (repo) => {
            if (!repo.path) return;
            try {
              const status = await RepositoryMonitoringService.getGitStatusWithFiles(repo.path);
              if (!cancelled && status) {
                newStatusMap.set(repo.path, status);
              }
            } catch (error) {
              console.error(`[ProjectsList] Failed to fetch git status for ${repo.path}:`, error);
            }
          })
      );

      if (!cancelled) {
        setGitStatusMap(newStatusMap);
      }
    };

    fetchGitStatuses();

    return () => {
      cancelled = true;
    };
  }, [repositories]);

  // Subscribe to git status changes for real-time updates
  useEffect(() => {
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged((status) => {
      setGitStatusMap(prev => {
        const updated = new Map(prev);
        updated.set(status.repoPath, status);
        return updated;
      });
    });

    return unsubscribe;
  }, []);

  // Track the configured base clone directory. The "+" create-repo flow needs
  // it to place new clones under `{baseDir}/{owner}/{name}`, and we only offer
  // the button when it's set. Stay in sync with Settings changes.
  useEffect(() => {
    let mounted = true;

    const apply = (prefs: { baseDefaultDirectory?: string | null }) => {
      if (mounted) setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    };

    void UserPreferencesService.getPreferences().then(apply);

    const handlePreferencesUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ baseDefaultDirectory?: string | null }>).detail;
      if (detail) apply(detail);
    };

    window.addEventListener('user-preferences-updated', handlePreferencesUpdated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('user-preferences-updated', handlePreferencesUpdated as EventListener);
    };
  }, []);

  // Handle project click — open the cloned entry, or the GitHub identity when not cloned
  const handleProjectClick = useCallback(
    (project: UnifiedProject) => {
      const payload = project.entry
        ? payloadFromLocalEntry(project.entry)
        : payloadFromGithub({
            owner: project.owner,
            name: project.name,
            description: project.description ?? undefined,
          });
      events.emit({
        type: 'repository:selected',
        source: 'projects-list-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events]
  );

  // Remove-from-list confirmation state. This flow only unregisters the
  // project from Alexandria; the clone on disk is untouched.
  const [removeConfirm, setRemoveConfirm] = useState<AlexandriaEntry | null>(null);
  const [relocateTarget, setRelocateTarget] = useState<UnifiedProject | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearAllBusy, setClearAllBusy] = useState(false);

  const handleConfirmRemove = useCallback(async () => {
    if (!removeConfirm) return;
    setRemoveBusy(true);
    try {
      await AlexandriaService.removeRepository(String(removeConfirm.path), false);
      setRemoveConfirm(null);
    } catch (error) {
      console.error('[ProjectsList] Failed to remove from registry:', error);
    } finally {
      setRemoveBusy(false);
    }
  }, [removeConfirm]);

  // Pick a folder and register every git repo found inside it (max depth 3,
  // matching the "Add a project" flow elsewhere). Re-registering already-tracked
  // repos is harmless — the main service backfills any missing remoteUrl.
  const handleScanFolder = useCallback(async () => {
    if (scanning) return;
    const picked = await FileSystemService.selectDirectory({
      title: 'Scan folder for projects',
      buttonLabel: 'Scan',
      properties: ['openDirectory'],
    });
    if (!picked || ('canceled' in picked && picked.canceled)) return;
    const rootPath = (picked as { filePaths?: string[] }).filePaths?.[0];
    if (!rootPath) return;

    setScanning(true);
    try {
      const repoPaths = await GitService.scanFolderForRepos(rootPath, 3);
      for (const repoPath of repoPaths) {
        try {
          await AlexandriaService.registerRepository(repoPath);
        } catch (error) {
          console.error(`[ProjectsList] Failed to register ${repoPath}:`, error);
        }
      }
    } catch (error) {
      console.error('[ProjectsList] Folder scan failed:', error);
    } finally {
      setScanning(false);
    }
  }, [scanning]);

  const handleConfirmClearAll = useCallback(async () => {
    setClearAllBusy(true);
    try {
      await AlexandriaService.clearAllData();
      setClearAllConfirm(false);
    } catch (error) {
      console.error('[ProjectsList] Failed to clear registry:', error);
    } finally {
      setClearAllBusy(false);
    }
  }, []);

  // Merge GitHub repos and local clones into one project model keyed by owner/name.
  const projects = useMemo<UnifiedProject[]>(() => {
    const map = new Map<string, UnifiedProject>();

    // 1) GitHub repos — start as not-cloned; local entries upgrade them below.
    for (const repo of githubRepos) {
      const owner = repo.owner.login;
      const key = `${owner.toLowerCase()}/${repo.name.toLowerCase()}`;
      map.set(key, {
        key,
        owner,
        name: repo.name,
        description: repo.description,
        isCloned: false,
        isDirty: false,
        isPrivate: repo.private,
        lastActivity: toMs(repo.pushed_at || repo.updated_at),
        cloneUrl: repo.clone_url || repo.html_url,
      });
    }

    // 2) Local registry entries — every entry is a clone on disk.
    for (const entry of repositories) {
      const owner = entry.github?.owner || 'Untracked';
      const name = entry.github?.name || entry.name;
      const key = `${owner.toLowerCase()}/${name.toLowerCase()}`;
      const gitStatus = entry.path ? gitStatusMap.get(entry.path) : undefined;
      const localActivity = Math.max(
        toMs(entry.github?.lastCommit),
        toMs(entry.lastOpenedAt),
        toMs(entry.registeredAt)
      );

      const offConvention = getOffConventionTarget(entry, baseDefaultDirectory);

      const existing = map.get(key);
      if (existing) {
        existing.isCloned = true;
        existing.entry = entry;
        existing.isDirty = gitStatus?.isDirty ?? false;
        existing.description = existing.description ?? entry.github?.description;
        existing.isPrivate = existing.isPrivate ?? toIsPrivate(entry.github?.isPublic);
        existing.lastActivity = Math.max(existing.lastActivity, localActivity);
        existing.offConvention = offConvention;
      } else {
        map.set(key, {
          key,
          owner,
          name,
          description: entry.github?.description,
          isCloned: true,
          isDirty: gitStatus?.isDirty ?? false,
          isPrivate: toIsPrivate(entry.github?.isPublic),
          entry,
          lastActivity: localActivity,
          cloneUrl: entry.remoteUrl,
          offConvention,
        });
      }
    }

    return Array.from(map.values());
  }, [githubRepos, repositories, gitStatusMap, baseDefaultDirectory]);

  // Apply filter + search, then group by org and order the groups.
  const { groups, sortedOrgNames } = useMemo(() => {
    let filtered = projects;
    if (filter === 'cloned') {
      filtered = filtered.filter(p => p.isCloned);
    } else if (filter === 'in-progress') {
      filtered = filtered.filter(p => p.isCloned && p.isDirty);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.owner.toLowerCase().includes(q) ||
          (p.description?.toLowerCase().includes(q) ?? false)
      );
    }

    const grouped = new Map<string, UnifiedProject[]>();
    for (const p of filtered) {
      const arr = grouped.get(p.owner) || [];
      arr.push(p);
      grouped.set(p.owner, arr);
    }

    // Sort within each org group. The In Progress filter shows the work the
    // user is actively in, so order it by most recent activity; every other
    // filter sorts alphabetically by name for a stable, predictable list.
    const sortByRecent = filter === 'in-progress';
    for (const [owner, arr] of grouped.entries()) {
      arr.sort((a, b) => {
        // Cloned (on-disk) projects sort first within each org; the rest keep
        // the usual order (recency under In Progress, otherwise alphabetical).
        if (a.isCloned !== b.isCloned) return a.isCloned ? -1 : 1;
        return sortByRecent
          ? b.lastActivity - a.lastActivity
          : a.name.localeCompare(b.name);
      });
      grouped.set(owner, arr);
    }

    // Order groups: the user's own org first, then member orgs, then others,
    // with Untracked pinned to the bottom.
    const orgNames = Array.from(grouped.keys());
    const userOwn = currentUser && orgNames.includes(currentUser) ? [currentUser] : [];
    const memberOrgs = orgNames
      .filter(o => o !== 'Untracked' && o !== currentUser && userOrgs.includes(o))
      .sort((a, b) => a.localeCompare(b));
    const otherOrgs = orgNames
      .filter(o => o !== 'Untracked' && o !== currentUser && !userOrgs.includes(o))
      .sort((a, b) => a.localeCompare(b));
    const untracked = orgNames.includes('Untracked') ? ['Untracked'] : [];

    return {
      groups: grouped,
      sortedOrgNames: [...userOwn, ...memberOrgs, ...otherOrgs, ...untracked],
    };
  }, [projects, filter, searchQuery, currentUser, userOrgs]);

  const hasClonedProjects = useMemo(
    () => repositories.some(r => r.path),
    [repositories]
  );

  // Toggle org collapsed state
  const toggleOrgCollapsed = useCallback((orgName: string) => {
    setCollapsedOrgs(prev => {
      const next = new Set(prev);
      if (next.has(orgName)) {
        next.delete(orgName);
      } else {
        next.add(orgName);
      }
      return next;
    });
  }, []);

  // Collapse busy orgs (more than 10 repos) by default. Applied once per org
  // on first appearance; after that the user's own toggles win.
  const DEFAULT_COLLAPSE_THRESHOLD = 10;
  useEffect(() => {
    const toCollapse: string[] = [];
    groups.forEach((repos, orgName) => {
      if (defaultedOrgsRef.current.has(orgName)) return;
      defaultedOrgsRef.current.add(orgName);
      if (repos.length > DEFAULT_COLLAPSE_THRESHOLD) toCollapse.push(orgName);
    });
    if (toCollapse.length) {
      setCollapsedOrgs(prev => {
        const next = new Set(prev);
        toCollapse.forEach(o => next.add(o));
        return next;
      });
    }
  }, [groups]);

  const isInitialLoading = githubLoading && projects.length === 0;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        overflow: 'hidden',
      }}
    >
      {/* Filter chips */}
      <div style={{ padding: spacing.sm, flexShrink: 0 }}>
        <SegmentedControl
          options={[
            { value: 'all', label: 'All' },
            { value: 'cloned', label: 'Cloned' },
            { value: 'in-progress', label: 'In Progress' },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as ProjectFilter)}
          theme={theme}
          variant="pill-flat"
        />
      </div>

      {/* Search + sort + clear-all */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.xs,
          padding: `${spacing.sm}px ${spacing.md}px`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.xs,
            backgroundColor: theme.colors.backgroundSecondary,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radii?.[1] || 4,
            padding: `${spacing.xs}px ${spacing.sm}px`,
          }}
        >
          <Search size={13} color={theme.colors.textSecondary} style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Filter projects..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: theme.fontSizes[1],
              color: theme.colors.text,
              caretColor: theme.colors.primary,
            }}
          />
        </div>

        {/* Scan a folder for git repos and add them to the list */}
        <button
          type="button"
          onClick={() => void handleScanFolder()}
          disabled={scanning}
          title="Scan a folder for git repos and add them to your projects"
          aria-label="Scan a folder for git repos"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            border: 'none',
            borderRadius: theme.radii?.[1] || 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: scanning ? 'default' : 'pointer',
            opacity: scanning ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (!scanning) e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          {scanning ? (
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <FolderSearch size={14} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setClearAllConfirm(true)}
          disabled={!hasClonedProjects}
          title="Remove all cloned projects from list (does not delete folders)"
          aria-label="Remove all cloned projects from list"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            padding: 0,
            border: 'none',
            borderRadius: theme.radii?.[1] || 4,
            background: 'transparent',
            color: theme.colors.textSecondary,
            cursor: hasClonedProjects ? 'pointer' : 'default',
            opacity: hasClonedProjects ? 1 : 0.4,
          }}
          onMouseEnter={(e) => {
            if (hasClonedProjects) {
              e.currentTarget.style.color = theme.colors.text;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.colors.textSecondary;
          }}
        >
          <Eraser size={14} />
        </button>
      </div>

      {/* Grouped project list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: `${spacing.sm}px ${spacing.xs}px`,
        }}
      >
        {isInitialLoading ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              gap: spacing.sm,
            }}
          >
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Loading projects…</span>
          </div>
        ) : sortedOrgNames.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
              textAlign: 'center',
            }}
          >
            <FolderGit2 size={32} style={{ marginBottom: spacing.sm, opacity: 0.3 }} />
            <span>No projects</span>
          </div>
        ) : (
          sortedOrgNames.map((orgName) => {
            const repos = groups.get(orgName) || [];
            // While searching, force every matching section open so results
            // aren't hidden behind a collapsed (or auto-collapsed) org.
            const isCollapsed = searchQuery.trim() ? false : collapsedOrgs.has(orgName);
            const isUserOwn = currentUser === orgName;
            const isMemberOrg = userOrgs.includes(orgName);
            const badge: 'you' | 'member' | undefined = isUserOwn
              ? 'you'
              : isMemberOrg
                ? 'member'
                : undefined;

            // We can add repos to an owner only when it's the user's own
            // account or a member org, and a base clone directory is set.
            const canAdd = !!baseDefaultDirectory && (isUserOwn || isMemberOrg);

            return (
              <div key={orgName} style={{ marginBottom: spacing.md }}>
                <OrgSectionHeaderCard
                  header={{
                    orgName,
                    badge,
                    repoCount: repos.length,
                    isUntracked: orgName === 'Untracked',
                  }}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggleOrgCollapsed(orgName)}
                  onAdd={
                    canAdd
                      ? () => setCreateTarget({ owner: orgName, isUser: isUserOwn })
                      : undefined
                  }
                  addLabel={`Add a repository to ${orgName}`}
                />

                {!isCollapsed && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      marginTop: spacing.xs,
                    }}
                  >
                    {repos.map((project) => (
                      <OrgRepoItemCard
                        key={project.key}
                        repo={{ name: project.name }}
                        isCloned={project.isCloned}
                        isDirty={project.isDirty}
                        isPrivate={project.isPrivate}
                        onClick={() => handleProjectClick(project)}
                        onClone={
                          !project.isCloned && project.cloneUrl
                            ? () => setCloneUrl(project.cloneUrl ?? null)
                            : undefined
                        }
                        onRemove={
                          project.entry ? () => setRemoveConfirm(project.entry ?? null) : undefined
                        }
                        offConvention={!!project.offConvention}
                        onRelocate={
                          project.offConvention && project.entry
                            ? () => setRelocateTarget(project)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Clone-to-disk modal, seeded with the selected repo's URL. The registry
          change event refreshes the list so the project flips to "cloned". */}
      <CloneFromGitHubModal
        isOpen={cloneUrl !== null}
        onClose={() => setCloneUrl(null)}
        initialUrl={cloneUrl ?? undefined}
      />

      {/* Relocate an off-convention clone into `{baseDir}/{owner}/{repo}`. The
          move re-keys the registry and broadcasts REPOSITORY_UPDATED, so the
          list refreshes and the off-convention icon clears automatically. */}
      {relocateTarget?.entry && relocateTarget.offConvention && (
        <RelocateToConventionModal
          isOpen
          repoName={relocateTarget.name}
          owner={relocateTarget.offConvention.owner}
          currentPath={String(relocateTarget.entry.path)}
          expectedPath={relocateTarget.offConvention.expectedPath}
          onRelocate={() =>
            WorkspaceService.moveRepositoryToConventionalPath(
              relocateTarget.entry as AlexandriaEntry,
              (relocateTarget.offConvention as { owner: string }).owner,
            )
          }
          onClose={() => setRelocateTarget(null)}
        />
      )}

      {/* Create a new repo under a specific owner, seeded from the owner-line
          "+". Skips destination/org selection; the registry-change event
          refreshes the list once the clone lands. */}
      <CreateRepositoryInWorkspaceModal
        isOpen={createTarget !== null}
        onClose={() => setCreateTarget(null)}
        baseDefaultDirectory={baseDefaultDirectory}
        presetOwner={createTarget?.owner}
        presetOwnerIsUser={createTarget?.isUser ?? false}
        onCreated={(repo) => {
          // Open the freshly created repo's profile, same as a normal click.
          // A local-only repo may not have a derivable purl yet; skip silently.
          try {
            events.emit({
              type: 'repository:selected',
              source: 'projects-list-panel',
              timestamp: Date.now(),
              payload: payloadFromLocalEntry(repo),
            });
          } catch (error) {
            console.error('[ProjectsList] Could not open new repo profile:', error);
          }
        }}
      />

      {/* Remove-from-list confirm. Does not touch files on disk. */}
      {removeConfirm && (
        <RemoveConfirmModal
          title="Remove from list?"
          body={
            <>
              This does not delete the folder — it just removes{' '}
              <span style={{ color: theme.colors.text }}>
                {removeConfirm.github
                  ? `${removeConfirm.github.owner}/${removeConfirm.github.name}`
                  : removeConfirm.name}
              </span>{' '}
              from this list. To delete the clone on disk, open the project and
              use the profile tab.
            </>
          }
          confirmLabel="Remove"
          busyLabel="Removing…"
          busy={removeBusy}
          onCancel={() => setRemoveConfirm(null)}
          onConfirm={() => void handleConfirmRemove()}
          theme={theme}
        />
      )}

      {clearAllConfirm && (
        <RemoveConfirmModal
          title="Remove all cloned projects from list?"
          body={
            <>
              Removes all cloned projects from this list. Your folders on disk are
              not deleted. To delete clones on disk, open each project and use its
              profile tab.
            </>
          }
          confirmLabel="Remove all"
          busyLabel="Removing…"
          busy={clearAllBusy}
          onCancel={() => setClearAllConfirm(false)}
          onConfirm={() => void handleConfirmClearAll()}
          theme={theme}
        />
      )}
    </div>
  );
};

interface RemoveConfirmModalProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}

const RemoveConfirmModal: React.FC<RemoveConfirmModalProps> = ({
  title,
  body,
  confirmLabel,
  busyLabel,
  busy,
  onCancel,
  onConfirm,
  theme,
}) => (
  <div
    onClick={() => {
      if (!busy) onCancel();
    }}
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 'min(440px, 90%)',
        padding: 20,
        borderRadius: 12,
        backgroundColor: theme.colors.backgroundSecondary,
        border: `1px solid ${theme.colors.border}`,
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <div
        style={{
          fontSize: theme.fontSizes[2],
          fontWeight: theme.fontWeights?.semibold ?? 600,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: theme.fontSizes[1],
          color: theme.colors.textSecondary,
          lineHeight: 1.4,
          marginBottom: 16,
        }}
      >
        {body}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: `1px solid ${theme.colors.border}`,
            background: 'transparent',
            color: theme.colors.text,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: 'none',
            background: theme.colors.primary,
            color: theme.colors.background,
            fontFamily: theme.fonts.body,
            fontSize: theme.fontSizes[1],
            fontWeight: theme.fontWeights?.semibold ?? 600,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ProjectsList;
