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
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../../main-process-api/GithubService';
import { GitService } from '../../main-process-api/GitService';
import { payloadFromGithub, payloadFromLocalEntry } from '../../events/repositorySelected';
import { useAuthState } from '../../hooks/useAuthState';
import { UserAboutCard, type UserAboutInfo } from './UserAboutCard';
import { HomeNavCards, type HomeNavKey, type HomeNavCardCounts } from './HomeNavCards';
import { HomeClonedSubView } from './sub-views/HomeClonedSubView';
import { HomeProjectsSubView, type ProjectSection } from './sub-views/HomeProjectsSubView';
import { HomeStarredSubView } from './sub-views/HomeStarredSubView';
import { HomeCollectionsSubView } from './sub-views/HomeCollectionsSubView';
import { HomeRecentSubView } from './sub-views/HomeRecentSubView';

// ---------------------------------------------------------------------------
// HomeLeftPanel — the home left rail, the user-based sibling of the
// owner/repo explorer's TrailListPane. Uses the shared SlidePane for
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
  const { user: authUser, isAuthenticated: isPrincipalSignedIn } = useAuthState();
  const [view, setView] = useState<HomeView>('home');

  // Sidebar Home (and any navigate-to-home-panel) always returns to the
  // about + nav-cards overview, even when a sub-view is already open.
  useEffect(() => {
    const handleShowOverview = () => setView('home');
    window.addEventListener('home-panel:show-overview', handleShowOverview);
    return () => {
      window.removeEventListener(
        'home-panel:show-overview',
        handleShowOverview,
      );
    };
  }, []);

  // If the user signs out while on a Principal-only sub-view, drop back home.
  useEffect(() => {
    if (
      !isPrincipalSignedIn &&
      (view === 'collections' || view === 'recent')
    ) {
      setView('home');
    }
  }, [isPrincipalSignedIn, view]);

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
  const clonedFullNames = useMemo(() => {
    const set = new Set<string>();
    for (const entry of repositories) {
      const owner = entry.github?.owner;
      const name = entry.github?.name;
      if (owner && name) {
        set.add(`${owner}/${name}`.toLowerCase());
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
      const [owner, name] = repo.full_name.split('/');
      const localEntry = repositories.find(
        (entry) => entry.github?.owner === owner && entry.github?.name === name,
      );
      const payload = localEntry
        ? payloadFromLocalEntry(localEntry)
        : payloadFromGithub({
            owner,
            name,
            description: repo.description ?? undefined,
            stars: repo.stargazers_count ?? 0,
            primaryLanguage: repo.language ?? undefined,
            isPublic: !repo.private,
            defaultBranch: repo.default_branch,
            lastUpdated: repo.updated_at,
          });
      events.emit({
        type: 'repository:selected',
        source: 'home-panel',
        timestamp: Date.now(),
        payload,
      });
    },
    [events, repositories],
  );

  const emitLocalEntrySelected = useCallback(
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
            <UserAboutCard info={aboutUser} loading={userLoading} />
            <HomeNavCards
              counts={counts}
              activeView={null}
              isPrincipalSignedIn={isPrincipalSignedIn}
              onOpenView={(key) => go(key)}
            />
          </div>
        ) : view === 'projects' ? (
          <HomeProjectsSubView
            key="projects"
            sections={projectSections}
            clonedFullNames={clonedFullNames}
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
        ) : view === 'collections' && isPrincipalSignedIn ? (
          <HomeCollectionsSubView
            key="collections"
            onBack={() => go('home')}
          />
        ) : view === 'recent' && isPrincipalSignedIn ? (
          <HomeRecentSubView
            key="recent"
            onBack={() => go('home')}
          />
        ) : null}
      </SlidePane>
    </div>
  );
};

export default HomeLeftPanel;
