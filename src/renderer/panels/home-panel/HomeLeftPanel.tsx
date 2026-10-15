/**
 * HomeLeftPanel
 *
 * The Home surface's left panel. Shows a UserAboutCard (GitHub profile), the
 * In Progress bar, a search bar, and the list of in-progress repositories
 * (uncommitted changes / unpushed commits), grouped by owner with
 * `OrgSectionHeaderCard` and rendered with the Projects-surface rows
 * (`OrgRepoItemCard`).
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { githubIdToPurl } from '@principal-ai/alexandria-core-library';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../../main-process-api/GithubService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import {
  extractLocalClones,
  payloadFromGithub,
  payloadFromLocalEntry,
  type RepositorySelectedPayload,
} from '../../events/repositorySelected';
import { useTheme } from '@principal-ade/industry-theme';
import { useAuthState } from '../../hooks/useAuthState';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import { OrgRepoItemCard } from '../cards/OrgRepoItemCard';
import { OrgSectionHeaderCard } from '../cards/OrgSectionHeaderCard';
import { emitTerminalOpen } from '../../events/portalIntents';
import { shellQuote } from '../../utils/shellQuote';
import { UserAboutCard } from './UserAboutCard';
import { type UserAboutInfo } from './useUserAboutInfo';
import { RepoAboutCard } from './RepoAboutCard';
import { InProgressBar } from './InProgressBar';
import { useInProgressRepos, type InProgressRepo } from './useInProgressRepos';
import { useWatchedRepos } from './useWatchedRepos';
import {
  HomeSearchBar,
  HomeSearchResults,
  type ProjectSection,
} from './HomeSearch';

// ---------------------------------------------------------------------------
// HomeLeftPanel — the home left rail, the user-based sibling of the
// owner/repo explorer.
// ---------------------------------------------------------------------------

export interface HomeLeftPanelProps {
  repositories: AlexandriaEntry[];
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
  events,
  aboutUser,
  userLoading,
}) => {
  // Principal app OAuth — re-runs the profile load on sign-in.
  const { user: authUser } = useAuthState();
  const { theme } = useTheme();
  const [selectedRepo, setSelectedRepo] =
    useState<RepositorySelectedPayload | null>(null);
  const [repoCardExiting, setRepoCardExiting] = useState(false);
  const { openInProgress, tabs } = useWorkspaceTabs();

  // Repos with uncommitted changes / unpushed commits — the in-progress list.
  const inProgressRepos = useInProgressRepos(repositories);
  // Repos the monitoring worker is watching — these have live git status;
  // unwatched repos are query-only and can show a stale sync count.
  const watchedPaths = useWatchedRepos();
  // Hide the bar's Open button when the In Progress tab is already open.
  const inProgressOpen = tabs.some((t) => t.id === 'in-progress-activity');

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

  // Starred repos are fetched lazily the first time the user searches.
  const [starredRepos, setStarredRepos] = useState<GitHubRepository[] | null>(
    null,
  );
  const starredRequestedRef = useRef(false);
  const ensureStarred = useCallback(() => {
    if (starredRequestedRef.current) return;
    starredRequestedRef.current = true;
    GithubService.getUserStarredRepositories({ perPage: 100 })
      .then((r) => setStarredRepos(r))
      .catch(() => setStarredRepos([]));
  }, []);

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

  // GitHub repos (user + orgs) searched by HomeSearchResults.
  const [projectSections, setProjectSections] = useState<
    ProjectSection[] | null
  >(null);

  // Fetch repos for project sections + counts — only when we have a GitHub identity
  const githubLogin =
    aboutUser?.source === 'github'
      ? aboutUser.login
      : (authUser?.login ?? null);

  useEffect(() => {
    if (!githubLogin) {
      setProjectSections(null);
      return;
    }
    let cancelled = false;

    const fetchRepos = async () => {
      try {
        const [userRepos, orgs] = await Promise.all([
          GithubService.getUserRepositories({
            perPage: 100,
            sort: 'updated',
            direction: 'desc',
          }),
          GithubService.getUserOrganizations().catch(() => []),
        ]);

        if (cancelled) return;

        // Group by owner
        const grouped = new Map<string, GitHubRepository[]>();
        for (const repo of userRepos) {
          const owner = repo.owner?.login ?? 'unknown';
          if (!grouped.has(owner)) grouped.set(owner, []);
          grouped.get(owner)!.push(repo);
        }

        // Fetch org repos
        const orgReposPromises = orgs.map(async (org) => {
          try {
            const repos = await GithubService.getOrgRepositories(org.login, {
              perPage: 100,
              sort: 'updated',
              direction: 'desc',
            });
            return {
              org: org.login,
              // Prefer GitHub profile display name over login for section headers.
              displayName: (org.name && org.name.trim()) || org.login,
              repos,
              avatar_url: org.avatar_url,
            };
          } catch {
            return {
              org: org.login,
              displayName: (org.name && org.name.trim()) || org.login,
              repos: [] as GitHubRepository[],
              avatar_url: org.avatar_url,
            };
          }
        });

        const orgResults = await Promise.all(orgReposPromises);
        if (cancelled) return;

        for (const { org, repos } of orgResults) {
          for (const repo of repos) {
            if (!grouped.has(org)) grouped.set(org, []);
            // Dedupe
            if (
              !grouped.get(org)!.some((r) => r.full_name === repo.full_name)
            ) {
              grouped.get(org)!.push(repo);
            }
          }
        }

        // Build sections: user first, then orgs
        const sections: ProjectSection[] = [];
        const userReposList = grouped.get(githubLogin);
        if (userReposList && userReposList.length > 0) {
          sections.push({
            key: githubLogin,
            label: 'Your repositories',
            repos: userReposList,
          });
        }

        for (const { org, displayName, avatar_url } of orgResults) {
          const orgReposList = grouped.get(org);
          if (orgReposList && orgReposList.length > 0) {
            sections.push({
              key: org,
              label: displayName,
              avatar_url,
              repos: orgReposList,
            });
          }
        }

        setProjectSections(sections);
      } catch {
        if (!cancelled) {
          setProjectSections([]);
        }
      }
    };

    void fetchRepos();
    return () => {
      cancelled = true;
    };
  }, [githubLogin]);

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
    (entry: AlexandriaEntry) => {
      events.emit({
        type: 'repository:selected',
        source: 'home-panel',
        timestamp: Date.now(),
        payload: payloadFromLocalEntry(entry),
      });
    },
    [events],
  );

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
    const groups = new Map<string, InProgressRepo[]>();
    for (const repo of inProgressRepos) {
      const owner = repo.entry.github?.owner ?? 'Untracked';
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
  }, [inProgressRepos, githubLogin]);

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
          {/* Full-width status row under the card: opens the singleton
              `in-progress-activity` workspace tab; shows the count. */}
          <InProgressBar
            count={inProgressRepos.length}
            onOpen={openInProgress}
            isOpen={inProgressOpen}
          />
          {/* Search bar — first thing under the In Progress line. */}
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
                  const isYou =
                    !isUntracked &&
                    githubLogin !== null &&
                    owner.toLowerCase() === githubLogin.toLowerCase();
                  return (
                    <div key={owner} style={{ marginBottom: 8 }}>
                      <OrgSectionHeaderCard
                        header={{
                          orgName: owner,
                          badge: isYou ? 'you' : undefined,
                          repoCount: repos.length,
                          isUntracked,
                        }}
                        isCollapsed={isCollapsed}
                        onToggle={() => toggleOwner(owner)}
                      />
                      {!isCollapsed &&
                        repos.map(({ entry, status }) => {
                          const name = entry.github?.name ?? entry.name;
                          const path = entry.path ? String(entry.path) : '';
                          return (
                            <OrgRepoItemCard
                              key={String(status.repoPath)}
                              repo={{ name }}
                              isCloned
                              isDirty={status.isDirty}
                              watching={path ? watchedPaths.has(path) : false}
                              sync={{
                                ahead: status.ahead,
                                behind: status.behind,
                              }}
                              dragText={path ? shellQuote(path) : undefined}
                              onClick={() => openInProgressRepo(entry)}
                              onOpenTerminal={
                                path
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
                  Nothing in progress — every tracked repository has a clean
                  working tree.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomeLeftPanel;
