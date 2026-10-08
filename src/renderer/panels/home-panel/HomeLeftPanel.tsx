/**
 * HomeLeftPanel
 *
 * The Home surface's left panel — a SlidePane carousel that mirrors the web
 * app's home left panel. The default "home" view shows a UserAboutCard
 * (GitHub profile) and HomeNavCards. Clicking a card slides to that sub-view;
 * a back button slides back to the overview.
 *
 * Nav order: Your Projects → Other Clones → Starred → (Principal) Collections / Recent.
 * "Cloned only" is a switch inside Your Projects, not its own card.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidePane, makeSlideDirection } from '../../components/SlidePane';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import { githubIdToPurl } from '@principal-ai/alexandria-core-library';
import type { GitHubRepository, GitHubUser } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { UserPreferencesService } from '../../main-process-api/UserPreferencesService';
import {
  extractLocalClones,
  payloadFromGithub,
  payloadFromLocalEntry,
  type RepositorySelectedPayload,
} from '../../events/repositorySelected';
import { useTheme } from '@principal-ade/industry-theme';
import { useAuthState } from '../../hooks/useAuthState';
import { useHomePanelPreferences } from '../../hooks/useHomePanelPreferences';
import { useWorkspaceTabs } from '../../principal-window/PortalTabsContext';
import { UserAboutCard, type UserAboutInfo } from './UserAboutCard';
import { RepoAboutCard } from './RepoAboutCard';
import { HomeNavCards, type HomeNavKey, type HomeNavCardCounts } from './HomeNavCards';
import { HomeClonedSubView } from './sub-views/HomeClonedSubView';
import { HomeProjectsSubView, type ProjectSection } from './sub-views/HomeProjectsSubView';
import { HomeStarredSubView } from './sub-views/HomeStarredSubView';
import { HomeCollectionsSubView } from './sub-views/HomeCollectionsSubView';
import { HomeRecentSubView } from './sub-views/HomeRecentSubView';
import { FollowersFollowingSubView } from './sub-views/FollowersFollowingSubView';

// ---------------------------------------------------------------------------
// HomeLeftPanel — the home left rail, the user-based sibling of the
// owner/repo explorer. Uses the shared SlidePane for
// animated carousel navigation between the overview and destination views.
// ---------------------------------------------------------------------------

export type HomeView = 'home' | HomeNavKey;

// 'home' is leftmost; opening a card slides in from the right, back slides left.
const HOME_SLIDE_ORDER: readonly HomeView[] = [
  'home',
  'projects',
  'other-clones',
  'starred',
  'collections',
  'recent',
];
const homeSlideDirection = makeSlideDirection(HOME_SLIDE_ORDER as readonly string[]);

async function loadGitIdentity(): Promise<UserAboutInfo | null> {
  const dir = process.env.HOME || '/';
  try {
    const [nameResult, emailResult] = await Promise.all([
      GitService.execCommand(dir, ['config', '--global', 'user.name']).catch(
        () => ({ stdout: '' }),
      ),
      GitService.execCommand(dir, ['config', '--global', 'user.email']).catch(
        () => ({ stdout: '' }),
      ),
    ]);
    const name = nameResult.stdout.trim() || null;
    const email = emailResult.stdout.trim() || null;
    if (!name && !email) return null;
    return {
      source: 'git',
      // login is required by the type; use email or name as a stable handle
      login: email || name || 'git',
      name,
      email,
    };
  } catch {
    return null;
  }
}

export interface HomeLeftPanelProps {
  repositories: AlexandriaEntry[];
  events: PanelEventEmitter;
}

export const HomeLeftPanel: React.FC<HomeLeftPanelProps> = ({
  repositories,
  events,
}) => {
  // Principal app OAuth — gates collections/recent and re-runs profile load.
  const { user: authUser, isAuthenticated: isPrincipalSignedIn, login: principalLogin } = useAuthState();
  const homePanelPrefs = useHomePanelPreferences();
  const { theme } = useTheme();
  const [view, setView] = useState<HomeView>('home');
  const [selectedRepo, setSelectedRepo] = useState<RepositorySelectedPayload | null>(null);
  const [repoCardExiting, setRepoCardExiting] = useState(false);
  const { openUserProfile } = useWorkspaceTabs();

  // Base directory for off-convention detection
  const [baseDefaultDirectory, setBaseDefaultDirectory] = useState<string | null>(null);
  useEffect(() => {
    UserPreferencesService.getPreferences().then((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
    return UserPreferencesService.onPreferencesUpdated((prefs) => {
      setBaseDefaultDirectory(prefs.baseDefaultDirectory || null);
    });
  }, []);

  // Sidebar Home (and any navigate-to-home-panel) always returns to the
  // about + nav-cards overview, even when a sub-view is already open.
  // Also clears the selected repo card so UserAboutCard returns.
  useEffect(() => {
    const handleShowOverview = () => {
      setSelectedRepo(null);
      setRepoCardExiting(false);
      setView('home');
    };
    window.addEventListener('home-panel:show-overview', handleShowOverview);
    return () => {
      window.removeEventListener(
        'home-panel:show-overview',
        handleShowOverview,
      );
    };
  }, []);

  // When the user signs out while on a Principal-only sub-view, drop back home.
  // Also drop back when the feature flag is off (shouldn't be reachable, but
  // defensive). Clear selected repo card.
  useEffect(() => {
    if (
      !isPrincipalSignedIn &&
      (view === 'collections' || view === 'recent')
    ) {
      setView('home');
      setSelectedRepo(null);
      setRepoCardExiting(false);
    }
    if (view === 'collections' && !homePanelPrefs.collections) {
      setView('home');
      setSelectedRepo(null);
      setRepoCardExiting(false);
    }
    if (view === 'recent' && !homePanelPrefs.recentlyVisited) {
      setView('home');
      setSelectedRepo(null);
      setRepoCardExiting(false);
    }
  }, [isPrincipalSignedIn, view, homePanelPrefs.collections, homePanelPrefs.recentlyVisited]);

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

  // About card: GitHub profile when CLI/API available, else git identity
  const [aboutUser, setAboutUser] = useState<UserAboutInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Projects data + owners the current user is considered to "own"
  // (personal login + orgs). Used to split Other Clones from Your Projects.
  const [projectSections, setProjectSections] = useState<ProjectSection[] | null>(null);
  const [ownedOwners, setOwnedOwners] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [counts, setCounts] = useState<HomeNavCardCounts>({});

  // Followers / following state for sub-view
  const [followersList, setFollowersList] = useState<GitHubUser[]>([]);
  const [followingList, setFollowingList] = useState<GitHubUser[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const handleOpenFollowers = useCallback(async () => {
    if (!aboutUser?.login) return;
    setListLoading(true);
    setView('followers');
    try {
      const users = await GithubService.getUserFollowers(aboutUser.login);
      setFollowersList(users);
    } catch (err) {
      console.error('[HomeLeftPanel] Failed to fetch followers:', err);
      setFollowersList([]);
    } finally {
      setListLoading(false);
    }
  }, [aboutUser?.login]);

  const handleOpenFollowing = useCallback(async () => {
    if (!aboutUser?.login) return;
    setListLoading(true);
    setView('following');
    try {
      const users = await GithubService.getUserFollowing(aboutUser.login);
      setFollowingList(users);
    } catch (err) {
      console.error('[HomeLeftPanel] Failed to fetch following:', err);
      setFollowingList([]);
    } finally {
      setListLoading(false);
    }
  }, [aboutUser?.login]);

  // Prefer GitHub (token API or `gh` CLI via getCurrentUser). If that fails,
  // fall back to global git config user.name / user.email so the about section
  // still has something useful when the user isn't signed into the CLI.
  useEffect(() => {
    let cancelled = false;
    setUserLoading(true);

    (async () => {
      try {
        const u = await GithubService.getCurrentUser();
        if (cancelled) return;
        if (u) {
          setAboutUser({
            source: 'github',
            login: u.login,
            name: u.name,
            email: u.email,
            avatar_url: u.avatar_url,
            html_url: `https://github.com/${u.login}`,
            bio: u.bio,
            company: u.company,
            location: u.location,
            followers: u.followers,
            following: u.following,
            public_repos: u.public_repos,
            created_at: u.created_at,
          });
          return;
        }

        const gitIdentity = await loadGitIdentity();
        if (!cancelled) setAboutUser(gitIdentity);
      } catch {
        if (cancelled) return;
        const gitIdentity = await loadGitIdentity();
        if (!cancelled) setAboutUser(gitIdentity);
      } finally {
        if (!cancelled) setUserLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser?.login]);

  // Fetch repos for project sections + counts — only when we have a GitHub identity
  const githubLogin =
    aboutUser?.source === 'github' ? aboutUser.login : authUser?.login ?? null;

  useEffect(() => {
    if (!githubLogin) {
      setOwnedOwners(new Set());
      setProjectSections(null);
      return;
    }
    let cancelled = false;

    const fetchRepos = async () => {
      try {
        const [userRepos, orgs] = await Promise.all([
          GithubService.getUserRepositories({ perPage: 100, sort: 'updated', direction: 'desc' }),
          GithubService.getUserOrganizations().catch(() => []),
        ]);

        if (cancelled) return;

        const owners = new Set<string>([githubLogin.toLowerCase()]);
        for (const org of orgs) {
          if (org.login) owners.add(org.login.toLowerCase());
        }
        setOwnedOwners(owners);

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
            if (!grouped.get(org)!.some((r) => r.full_name === repo.full_name)) {
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
        setCounts((prev) => ({ ...prev, projects: userRepos.length }));
      } catch {
        if (!cancelled) {
          setProjectSections([]);
          setOwnedOwners(new Set([githubLogin.toLowerCase()]));
        }
      }
    };

    void fetchRepos();
    return () => { cancelled = true; };
  }, [githubLogin]);

  // Local clones keyed for "Cloned only" in Your Projects.
  // Uses PURL as the canonical identifier so matching is case-insensitive
  // and robust to owner/name casing differences between the registry and
  // the GitHub API.
  const clonedPurls = useMemo(() => {
    const set = new Set<string>();
    for (const entry of repositories) {
      const purl =
        entry.purl ??
        entry.github?.purl;
      if (purl) {
        set.add(purl);
      } else if (entry.github?.owner && entry.github?.name) {
        set.add(githubIdToPurl(`${entry.github.owner}/${entry.github.name}`));
      }
    }
    return set;
  }, [repositories]);

  // Other Clones: local checkouts whose GitHub owner is not the user / their orgs.
  // Untracked (no github owner) always land here.
  const otherClones = useMemo(() => {
    return repositories.filter((entry) => {
      const owner = entry.github?.owner?.toLowerCase();
      if (!owner) return true;
      // No known identity yet → treat everything with an owner as "other"
      // only if we have zero owned owners (still loading / signed out of gh).
      // Once ownedOwners is populated, filter properly.
      if (ownedOwners.size === 0) {
        // If we have a githubLogin we haven't finished loading orgs for,
        // still exclude the personal login as "yours".
        if (githubLogin && owner === githubLogin.toLowerCase()) return false;
        return true;
      }
      return !ownedOwners.has(owner);
    });
  }, [repositories, ownedOwners, githubLogin]);

  useEffect(() => {
    setCounts((prev) => ({
      ...prev,
      'other-clones': otherClones.length || null,
    }));
  }, [otherClones.length]);

  const go = useCallback((next: HomeView) => {
    setView(next);
  }, []);

  // Build the proper repository:selected payload for a GitHub repo, matching
  // against local clones when available (so the profile panel knows the path).
  const emitRepoSelected = useCallback(
    (repo: GitHubRepository) => {
      const purl = githubIdToPurl(repo.full_name);
      const matchingEntries = repositories.filter((entry) => {
        const entryPurl =
          entry.purl ??
          entry.github?.purl;
        if (entryPurl) return entryPurl === purl;
        if (entry.github?.owner && entry.github?.name) {
          return githubIdToPurl(`${entry.github.owner}/${entry.github.name}`) === purl;
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
      const payload = payloadFromLocalEntry(entry, matchingEntries.length > 0 ? matchingEntries : undefined);
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
        <SlidePane viewKey={view} resolveDirection={homeSlideDirection}>
          {view === 'home' ? (
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
              <UserAboutCard
                info={aboutUser}
                loading={userLoading}
                clonedCount={clonedPurls.size}
                onOpenFollowers={handleOpenFollowers}
                onOpenFollowing={handleOpenFollowing}
                isPrincipalSignedIn={isPrincipalSignedIn}
                onLogin={() => principalLogin()}
              />
              <HomeNavCards
                counts={counts}
                activeView={null}
                isPrincipalSignedIn={isPrincipalSignedIn}
                showCollections={homePanelPrefs.collections}
                showRecentlyVisited={homePanelPrefs.recentlyVisited}
                onOpenView={(key) => go(key)}
              />
            </div>
          ) : view === 'projects' ? (
            <HomeProjectsSubView
              key="projects"
              sections={projectSections}
              clonedPurls={clonedPurls}
              onBack={() => go('home')}
              onSelectRepo={(repo) => emitRepoSelected(repo)}
            />
          ) : view === 'other-clones' ? (
            <HomeClonedSubView
              key="other-clones"
              repositories={otherClones}
              label="Other Clones"
              emptyMessage="No other clones yet. Local checkouts that aren't yours will show up here."
              onBack={() => go('home')}
              onSelectEntry={emitLocalEntrySelected}
            />
          ) : view === 'starred' ? (
            <HomeStarredSubView
              key="starred"
              onBack={() => go('home')}
              onSelectRepo={(repo) => emitRepoSelected(repo)}
            />
          ) : view === 'collections' && isPrincipalSignedIn && homePanelPrefs.collections ? (
            <HomeCollectionsSubView
              key="collections"
              onBack={() => go('home')}
            />
          ) : view === 'recent' && isPrincipalSignedIn && homePanelPrefs.recentlyVisited ? (
            <HomeRecentSubView
              key="recent"
              onBack={() => go('home')}
            />
          ) : view === 'followers' ? (
            <FollowersFollowingSubView
              key="followers"
              users={followersList}
              loading={listLoading}
              label="Followers"
              onBack={() => go('home')}
              onUserClick={(username) => openUserProfile(username)}
            />
          ) : view === 'following' ? (
            <FollowersFollowingSubView
              key="following"
              users={followingList}
              loading={listLoading}
              label="Following"
              onBack={() => go('home')}
              onUserClick={(username) => openUserProfile(username)}
            />
          ) : null}
        </SlidePane>
      </div>
    </div>
  );
};

export default HomeLeftPanel;
