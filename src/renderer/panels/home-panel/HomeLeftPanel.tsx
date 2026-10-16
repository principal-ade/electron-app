/**
 * HomeLeftPanel
 *
 * The Home surface's left panel. Shows a UserAboutCard (GitHub profile), the
 * In Progress bar, a search bar, and the list of in-progress repositories
 * (open tabs / uncommitted changes / unpushed commits), grouped by owner with
 * `OrgSectionHeaderCard` and rendered with the Projects-surface rows
 * (`OrgRepoItemCard`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { githubIdToPurl } from '@principal-ai/alexandria-core-library';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import { GitService } from '../../main-process-api/GitService';
import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import {
  extractLocalClones,
  payloadFromGithub,
  payloadFromLocalEntry,
  type RepositorySelectedPayload,
} from '../../events/repositorySelected';
import { useTheme } from '@principal-ade/industry-theme';
import { useAuthUser } from '../../providers/AuthProvider';
import { OrgRepoItemCard } from '../cards/OrgRepoItemCard';
import { OrgSectionHeaderCard } from '../cards/OrgSectionHeaderCard';
import { emitTerminalOpen } from '../../events/portalIntents';
import { shellQuote } from '../../utils/shellQuote';
import {
  useGithubOrganizations,
  useGithubProjectSections,
  useGithubStarred,
} from '../../hooks/useGithubGraph';
import { resolveOwnerIdentity } from '../ownerIdentity';
import { UserAboutCard } from './UserAboutCard';
import { type UserAboutInfo } from './useUserAboutInfo';
import { RepoAboutCard } from './RepoAboutCard';
import { useInProgressRepos } from './useInProgressRepos';
import { getHomeRepositories, type HomeRepository } from './homeRepositories';
import type { WorkspaceTab } from '../../principal-window/PortalTabsContext';
import { useWatchedRepos } from './useWatchedRepos';
import { HomeSearchBar, HomeSearchResults } from './HomeSearch';
import { PushToRemoteModal } from '../components/PushToRemoteModal';

// ---------------------------------------------------------------------------
// HomeLeftPanel — the home left rail, the user-based sibling of the
// owner/repo explorer.
// ---------------------------------------------------------------------------

export interface HomeLeftPanelProps {
  repositories: AlexandriaEntry[];
  tabs: WorkspaceTab[];
  events: PanelEventEmitter;
  /**
   * Home profile (GitHub or git identity), owned by WorkspaceShell so it
   * survives this panel unmounting when the left panel is swapped.
   */
  aboutUser: UserAboutInfo | null;
  userLoading: boolean;
}

export const HomeLeftPanel: React.FC<HomeLeftPanelProps> = ({
  repositories,
  tabs,
  events,
  aboutUser,
  userLoading,
}) => {
  // Principal app OAuth — re-runs the profile load on sign-in.
  const { user: authUser, profile } = useAuthUser();
  const { theme } = useTheme();
  const [selectedRepo, setSelectedRepo] =
    useState<RepositorySelectedPayload | null>(null);
  const [repoCardExiting, setRepoCardExiting] = useState(false);
  // The repo whose ahead indicator was clicked — opens the push-to-remote modal.
  const [pushTarget, setPushTarget] = useState<{
    path: string;
    name: string;
    ahead: number;
    branch?: string;
  } | null>(null);

  // Repos with uncommitted changes / unpushed commits — the in-progress list.
  // `statusRefreshKey` forces a re-query after a push clears an ahead count.
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);
  const inProgressRepos = useInProgressRepos(repositories, statusRefreshKey);
  const homeRepos = useMemo(
    () => getHomeRepositories(repositories, inProgressRepos, tabs),
    [repositories, inProgressRepos, tabs],
  );
  // Repos the monitoring worker is watching — these have live git status;
  // unwatched repos are query-only and can show a stale sync count.
  const watchedPaths = useWatchedRepos();

  // Group the in-progress repos by owner, the way the Projects surface does:
  // the owner is carried by the section header, the row shows only the repo.
  // The signed-in login's group sorts first, "Untracked" last.
  const [collapsedOwners, setCollapsedOwners] = useState<Set<string>>(
    () => new Set(),
  );
  const toggleOwner = useCallback((owner: string) => {
    setCollapsedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(owner)) next.delete(owner);
      else next.add(owner);
      return next;
    });
  }, []);

  // Search across projects / clones / starred. The nav cards hide while a
  // query is active.
  const [searchQuery, setSearchQuery] = useState('');
  const searchActive = searchQuery.trim().length > 0;

  // Starred repos are loaded lazily by the shared graph store the first time the
  // user searches (same cache the Projects list's Starred filter uses).
  const { starredRepos, ensure: ensureStarred } = useGithubStarred();
  useEffect(() => {
    if (searchActive) ensureStarred();
  }, [searchActive, ensureStarred]);

  // Base directory for off-convention detection
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<
    string | null
  >(null);
  useEffect(() => {
    UserPreferencesService.getPreferences().then((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
    return UserPreferencesService.onPreferencesUpdated((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
  }, []);

  // Sidebar Home (and any navigate-to-home-panel) clears the selected repo
  // card so UserAboutCard returns to the overview.
  useEffect(() => {
    const handleShowOverview = () => {
      setSelectedRepo(null);
      setRepoCardExiting(false);
    };
    window.addEventListener('home-panel:show-overview', handleShowOverview);
    return () => {
      window.removeEventListener(
        'home-panel:show-overview',
        handleShowOverview,
      );
    };
  }, []);

  // Keep selectedRepo.localClones in sync when the registry changes (e.g. after
  // a clone is deleted via the RepoAboutCard delete button). Without this the
  // card holds a stale snapshot and the deleted clone keeps showing.
  useEffect(() => {
    if (!selectedRepo) return;
    const purl = selectedRepo.purl;
    if (!purl) return;
    const matchingEntries = repositories.filter(
      (e) => (e.purl ?? e.github?.purl) === purl,
    );
    const currentPaths = selectedRepo.localClones?.map((c) => c.path) ?? [];
    const nextClones =
      matchingEntries.length > 0
        ? Array.from(
            new Map(
              matchingEntries.flatMap((e) =>
                (extractLocalClones(e) ?? []).map((c) => [c.path, c] as const),
              ),
            ).values(),
          )
        : [];
    const nextPaths = nextClones.map((c) => c.path);
    if (
      nextPaths.length === currentPaths.length &&
      nextPaths.every((p, i) => p === currentPaths[i])
    ) {
      return; // no change
    }
    setSelectedRepo((prev) =>
      prev ? { ...prev, localClones: nextClones } : prev,
    );
  }, [repositories, selectedRepo?.purl]);

  const dismissRepoCard = useCallback(() => {
    setRepoCardExiting(true);
    setTimeout(() => {
      setSelectedRepo(null);
      setRepoCardExiting(false);
    }, 320);
  }, []);

  // GitHub repo sections for the search — served from the shared graph store
  // (the same fan-out the Projects list uses), not a second copy of it.
  const projectSections = useGithubProjectSections();
  const githubLogin = authUser?.login ?? null;

  // Orgs (with display names + avatars) for the in-progress section headers.
  const { orgs } = useGithubOrganizations();

  // Owner login → display label/avatar. Grouping/ordering stay keyed on the
  // login; only the header label changes (see {@link resolveOwnerIdentity}).
  const ownerDirectory = useMemo(
    () => ({
      selfLogin: githubLogin,
      selfName: profile?.name,
      selfAvatarUrl: profile?.avatar_url,
      orgs,
    }),
    [githubLogin, profile, orgs],
  );

  // Build the proper repository:selected payload for a GitHub repo, matching
  // against local clones when available (so the profile panel knows the path).
  const emitRepoSelected = useCallback(
    (repo: GitHubRepository) => {
      const purl = githubIdToPurl(repo.full_name);
      const matchingEntries = repositories.filter((entry) => {
        const entryPurl = entry.purl ?? entry.github?.purl;
        if (entryPurl) return entryPurl === purl;
        if (entry.github?.owner && entry.github?.name) {
          return (
            githubIdToPurl(`${entry.github.owner}/${entry.github.name}`) ===
            purl
          );
        }
        return false;
      });
      const localEntry = matchingEntries[0];
      const payload = localEntry
        ? payloadFromLocalEntry(localEntry, matchingEntries)
        : payloadFromGithub({
            owner: repo.owner.login,
            name: repo.name,
            description: repo.description ?? undefined,
            stars: repo.stargazers_count ?? 0,
            primaryLanguage: repo.language ?? undefined,
            isPublic: !repo.private,
            defaultBranch: repo.default_branch,
            lastUpdated: repo.updated_at,
            createdAt: repo.created_at,
          });
      setSelectedRepo(payload);
      events.emit({
        type: 'repository:guide-open',
        source: 'home-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events, repositories],
  );

  const emitLocalEntrySelected = useCallback(
    (entry: AlexandriaEntry) => {
      const matchingEntries = repositories.filter((e) => {
        const ep = e.purl ?? e.github?.purl;
        const ip = entry.purl ?? entry.github?.purl;
        return ep && ip && ep === ip;
      });
      const payload = payloadFromLocalEntry(
        entry,
        matchingEntries.length > 0 ? matchingEntries : undefined,
      );
      setSelectedRepo(payload);
      events.emit({
        type: 'repository:guide-open',
        source: 'home-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events, repositories],
  );

  // Open the repo profile tab for an in-progress row (mirrors InProgressRepoCard;
  // the Projects rows open the profile rather than the guide).
  const openInProgressRepo = useCallback(
    (payload: RepositorySelectedPayload) => {
      events.emit({
        type: 'repository:selected',
        source: 'home-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events],
  );

  // Push the clicked repo's local commits to its upstream (creating the
  // upstream if the branch has none yet). Shared by the push modal.
  const pushToRemote = useCallback(
    async (
      path: string,
    ): Promise<{ success: boolean; message: string }> => {
      const safety = await GitService.isPushSafe(path);
      return GitService.push(
        path,
        safety.needsUpstream ? { setUpstream: true } : undefined,
      );
    },
    [],
  );

  // After a successful push: re-query every status (an unwatched repo's cached
  // ahead count would otherwise stay stale) and ask the monitor to re-check.
  const handlePushed = useCallback((path: string) => {
    setStatusRefreshKey((k) => k + 1);
    RepositoryMonitoringService.refreshRepository(path).catch((err) => {
      console.warn('[HomeLeftPanel] Failed to refresh after push:', err);
    });
  }, []);

  // Hover action on an in-progress row: open a terminal tab at the clone's path.
  const openTerminalForEntry = useCallback(
    (entry: AlexandriaEntry, label: string) => {
      if (!entry.path) return;
      emitTerminalOpen(events, 'home-panel', {
        directory: String(entry.path),
        label,
      });
    },
    [events],
  );

  // In-progress repos grouped by owner for the section-header list.
  const inProgressGroups = useMemo(() => {
    const groups = new Map<string, HomeRepository[]>();
    for (const repo of homeRepos) {
      const owner = repo.payload.github?.owner ?? 'Untracked';
      const bucket = groups.get(owner);
      if (bucket) bucket.push(repo);
      else groups.set(owner, [repo]);
    }
    const login = githubLogin?.toLowerCase() ?? null;
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Untracked' || b === 'Untracked') {
        return a === b ? 0 : a === 'Untracked' ? 1 : -1;
      }
      const aYou = login !== null && a.toLowerCase() === login;
      const bYou = login !== null && b.toLowerCase() === login;
      if (aYou !== bYou) return aYou ? -1 : 1;
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  }, [homeRepos, githubLogin]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {(selectedRepo || repoCardExiting) && (
        <div
          key="repo-about-slide"
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            overflowY: 'auto',
            background: theme.colors.background,
            animation: repoCardExiting
              ? 'repoAboutSlideOut 320ms ease forwards'
              : 'repoAboutSlideIn 320ms ease',
          }}
        >
          <style>{`
            @keyframes repoAboutSlideIn {
              from { transform: translateX(100%); }
              to   { transform: translateX(0); }
            }
            @keyframes repoAboutSlideOut {
              from { transform: translateX(0); }
              to   { transform: translateX(100%); }
            }
          `}</style>
          {selectedRepo && (
            <RepoAboutCard
              repo={selectedRepo}
              onDismiss={dismissRepoCard}
              events={events}
              baseDefaultDirectory={baseDefaultDirectory}
            />
          )}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          ...(selectedRepo || repoCardExiting
            ? { pointerEvents: 'none' as const }
            : undefined),
        }}
      >
        <div
          key="home"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <UserAboutCard info={aboutUser} loading={userLoading} />
          {/* Search bar — first thing under the about card. */}
          <HomeSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onFocus={ensureStarred}
          />
          {searchActive ? (
            <HomeSearchResults
              query={searchQuery}
              projectSections={projectSections}
              repositories={repositories}
              starredRepos={starredRepos}
              onSelectRepo={emitRepoSelected}
              onSelectEntry={emitLocalEntrySelected}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '4px 4px',
              }}
            >
              {inProgressGroups.length > 0 &&
                inProgressGroups.map(([owner, repos]) => {
                  const isUntracked = owner === 'Untracked';
                  const isCollapsed = collapsedOwners.has(owner);
                  const identity = resolveOwnerIdentity(owner, ownerDirectory);
                  return (
                    <div key={owner} style={{ marginBottom: 8 }}>
                      <OrgSectionHeaderCard
                        header={{
                          orgName: identity.label,
                          login: identity.login,
                          avatarUrl: identity.avatarUrl,
                          badge: identity.isSelf ? 'you' : undefined,
                          repoCount: repos.length,
                          isUntracked,
                        }}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleOwner(owner)}
                      />
                      {!isCollapsed &&
                        repos.map(({ key, payload, status }) => {
                          const entry = payload.localEntry;
                          const name =
                            payload.github?.name ?? entry?.name ?? payload.purl;
                          const path = entry?.path ? String(entry.path) : '';
                          return (
                            <OrgRepoItemCard
                              key={key}
                              repo={{ name }}
                              isCloned={!!path}
                              isDirty={status?.isDirty}
                              watching={path ? watchedPaths.has(path) : false}
                              sync={{
                                ahead: status?.ahead,
                                behind: status?.behind,
                              }}
                              onPushAhead={
                                path && (status?.ahead ?? 0) > 0
                                  ? () =>
                                      setPushTarget({
                                        path,
                                        name,
                                        ahead: status?.ahead ?? 0,
                                        branch: status?.branch,
                                      })
                                  : undefined
                              }
                              dragText={path ? shellQuote(path) : undefined}
                              onClick={() => openInProgressRepo(payload)}
                              onOpenTerminal={
                                path && entry
                                  ? () => openTerminalForEntry(entry, name)
                                  : undefined
                              }
                            />
                          );
                        })}
                    </div>
                  );
                })}

              {inProgressGroups.length === 0 && (
                <div
                  style={{
                    padding: '24px 16px',
                    color: theme.colors.textMuted,
                    fontSize: theme.fontSizes[1],
                    lineHeight: 1.5,
                  }}
                >
                  Nothing in progress — no open repository tabs, uncommitted
                  changes, or unpushed commits.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <PushToRemoteModal
        isOpen={pushTarget !== null}
        onClose={() => setPushTarget(null)}
        repoName={pushTarget?.name ?? ''}
        aheadCount={pushTarget?.ahead ?? 0}
        branch={pushTarget?.branch}
        onPush={() =>
          pushTarget
            ? pushToRemote(pushTarget.path)
            : Promise.resolve({ success: false, message: 'No repository.' })
        }
        onPushed={() => {
          if (pushTarget) handlePushed(pushTarget.path);
        }}
      />
    </div>
  );
};

export default HomeLeftPanel;
