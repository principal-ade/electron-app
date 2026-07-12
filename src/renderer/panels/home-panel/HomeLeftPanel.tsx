/**
 * HomeLeftPanel
 *
 * The Home surface's left panel — a SlidePane carousel that mirrors the web
 * app's home left panel. The default "home" view shows a UserAboutCard
 * (GitHub profile) and HomeNavCards (6 clickable cards). Clicking a card
 * slides to that sub-view; a back button slides back to the overview.
 *
 * This is the first consumer of the shared SlidePane component. Other surfaces
 * (Trails, Topics) can reuse SlidePane for their own carousel navigation.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { SlidePane, makeSlideDirection } from '../../components/SlidePane';
import type { PanelEventEmitter } from '@principal-ade/panel-framework-core';
import type { AlexandriaEntry } from '@principal-ai/alexandria-core-library/types';
import type { GitHubRepository } from '../../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../../main-process-api/GithubService';
import { payloadFromGithub, payloadFromLocalEntry } from '../../events/repositorySelected';
import { useAuthState } from '../../hooks/useAuthState';
import { UserAboutCard, type UserAboutInfo } from './UserAboutCard';
import { HomeNavCards, type HomeNavKey, type HomeNavCardCounts } from './HomeNavCards';
import { HomeProjectsSubView, type ProjectSection } from './sub-views/HomeProjectsSubView';
import { HomeStarredSubView } from './sub-views/HomeStarredSubView';
import { HomeCollectionsSubView } from './sub-views/HomeCollectionsSubView';
import { HomeBookmarksSubView } from './sub-views/HomeBookmarksSubView';
import { HomeLibrarySubView } from './sub-views/HomeLibrarySubView';
import { HomeRecentSubView } from './sub-views/HomeRecentSubView';

// ---------------------------------------------------------------------------
// HomeLeftPanel — the signed-in home's left rail, the user-based sibling of
// the owner/repo explorer's TrailListPane. Uses the shared SlidePane for
// animated carousel navigation between the overview and destination views.
// ---------------------------------------------------------------------------

export type HomeView = 'home' | HomeNavKey;

// 'home' is leftmost; opening a card slides in from the right, back slides left.
const HOME_SLIDE_ORDER: readonly HomeView[] = [
  'home',
  'projects',
  'starred',
  'collections',
  'bookmarks',
  'library',
  'recent',
];
const homeSlideDirection = makeSlideDirection(HOME_SLIDE_ORDER as readonly string[]);

export interface HomeLeftPanelProps {
  repositories: AlexandriaEntry[];
  events: PanelEventEmitter;
}

export const HomeLeftPanel: React.FC<HomeLeftPanelProps> = ({
  repositories,
  events,
}) => {
  const { user: authUser } = useAuthState();
  const [view, setView] = useState<HomeView>('home');

  // GitHub user profile (enriched)
  const [githubUser, setGithubUser] = useState<UserAboutInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);

  // Projects data
  const [projectSections, setProjectSections] = useState<ProjectSection[] | null>(null);

  // Counts
  const [counts, setCounts] = useState<HomeNavCardCounts>({});

  // Fetch enriched GitHub user profile
  useEffect(() => {
    if (!authUser?.login) {
      setUserLoading(false);
      return;
    }
    let cancelled = false;
    setUserLoading(true);
    GithubService.getCurrentUser()
      .then((u) => {
        if (!cancelled && u) {
          setGithubUser({
            login: u.login,
            name: u.name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            company: u.company,
            location: u.location,
            followers: u.followers,
            following: u.following,
            public_repos: u.public_repos,
            created_at: u.created_at,
          });
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setUserLoading(false); });
    return () => { cancelled = true; };
  }, [authUser?.login]);

  // Fetch repos for project sections + counts
  useEffect(() => {
    if (!authUser?.login) return;
    let cancelled = false;

    const fetchRepos = async () => {
      try {
        const [userRepos, orgs] = await Promise.all([
          GithubService.getUserRepositories({ perPage: 100, sort: 'updated', direction: 'desc' }),
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
            const repos = await GithubService.getOrgRepositories(org.login, { perPage: 100, sort: 'updated', direction: 'desc' });
            return { org: org.login, repos };
          } catch {
            return { org: org.login, repos: [] as GitHubRepository[] };
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
        const userReposList = grouped.get(authUser.login);
        if (userReposList && userReposList.length > 0) {
          sections.push({
            key: authUser.login,
            label: 'Your repositories',
            repos: userReposList,
          });
        }

        for (const org of orgs) {
          const orgReposList = grouped.get(org.login);
          if (orgReposList && orgReposList.length > 0) {
            sections.push({
              key: org.login,
              label: org.login,
              avatar_url: org.avatar_url,
              repos: orgReposList,
            });
          }
        }

        setProjectSections(sections);
        setCounts((prev) => ({ ...prev, projects: userRepos.length }));
      } catch {
        if (!cancelled) setProjectSections([]);
      }
    };

    void fetchRepos();
    return () => { cancelled = true; };
  }, [authUser?.login]);

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
            <UserAboutCard info={githubUser} loading={userLoading} />
            <HomeNavCards
              counts={counts}
              activeView={null}
              onOpenView={(key) => go(key)}
            />
          </div>
        ) : view === 'projects' ? (
          <HomeProjectsSubView
            key="projects"
            sections={projectSections}
            onBack={() => go('home')}
            onSelectRepo={(repo) => emitRepoSelected(repo)}
          />
        ) : view === 'starred' ? (
          <HomeStarredSubView
            key="starred"
            onBack={() => go('home')}
            onSelectRepo={(repo) => emitRepoSelected(repo)}
          />
        ) : view === 'collections' ? (
          <HomeCollectionsSubView
            key="collections"
            onBack={() => go('home')}
          />
        ) : view === 'bookmarks' ? (
          <HomeBookmarksSubView
            key="bookmarks"
            onBack={() => go('home')}
          />
        ) : view === 'library' ? (
          <HomeLibrarySubView
            key="library"
            onBack={() => go('home')}
          />
        ) : view === 'recent' ? (
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
