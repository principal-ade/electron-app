import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import { useAuthState } from '../../../hooks/useAuthState';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../shared/types/repository.types';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { WindowService } from '../../../main-process-api/WindowService';
import { GithubService } from '../../../main-process-api/GithubService';
import { UserPreferencesService } from '../../../main-process-api/UserPreferencesService';
import type { GitHubRepository } from '../../../../shared/main-process-api-interfaces/GitHubAPI';
import { OrganizationSidebar } from './components/OrganizationSidebar';
import { RepositoryGrid } from './components/RepositoryGrid';
import { AuthDetails } from './components/AuthDetails';
import {
  groupRepositoriesByOrganization,
  sortOrganizations,
  type OrganizationInfo,
} from './utils/repositoryOrganizer';
import { usePanelPersistence } from '../../../hooks/usePanelPersistence';
import './AuthView.css';

export const AuthView: React.FC = () => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();
  const {
    isAuthenticated,
    user: authUser,
    login,
    logout,
    isLoggingIn,
    loginError,
    clearLoginError,
  } = useAuthState();

  const [repositories, setRepositories] = useState<EnhancedAlexandriaEntry[]>([]);
  const [remoteRepositories, setRemoteRepositories] = useState<GitHubRepository[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [repositoriesByOrg, setRepositoriesByOrg] = useState<Map<string, EnhancedAlexandriaEntry[]>>(new Map());
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthView, setShowAuthView] = useState(false);
  const [panelSizes, setPanelSizes] = useState({ left: 25, right: 75 });

  // Use panel persistence hook
  const panelState = usePanelPersistence({
    viewKey: 'authView',
    defaultSizes: panelSizes,
    collapsed: { left: false },
    panelType: 'two-panel',
  });

  const backgroundColor = theme.colors.background;

  // Helper function to enhance a repository with git info
  const enhanceRepositoryWithGitInfo = useCallback(async (repo: AlexandriaEntry): Promise<EnhancedAlexandriaEntry> => {
    try {
      // Get git branch
      const branchResult = await GitService.execCommand(repo.path, [
        'rev-parse',
        '--abbrev-ref',
        'HEAD',
      ]).catch(() => ({ stdout: 'main', stderr: '' }));
      const gitBranch = branchResult.stdout.trim() || 'main';

      // Get git status to check if dirty
      const status = await GitService.getStatus(repo.path).catch(() => ({
        staged: [],
        unstaged: [],
        untracked: [],
        deleted: [],
      }));

      const isDirty = status.staged.length > 0 ||
                     status.unstaged.length > 0 ||
                     status.untracked.length > 0;
      const dirtyFileCount = status.staged.length + status.unstaged.length + status.untracked.length;

      let mostRecentChange = repo.github?.lastCommit;

      // If there are uncommitted changes, get the most recent file modification time
      if (isDirty) {
        try {
          const allChangedFiles = [...status.staged, ...status.unstaged, ...status.untracked];
          const fileStats = await Promise.all(
            allChangedFiles.map(async (filePath) => {
              try {
                const fullPath = `${repo.path}/${filePath}`;
                const stats = await FileSystemService.getFileStats(fullPath);
                return stats?.lastModified || null;
              } catch (_error) {
                return null;
              }
            })
          );

          const validTimes = fileStats.filter(time => time);
          if (validTimes.length > 0) {
            const recentTime = validTimes.reduce((latest, current) => {
              if (!latest) return current;
              if (!current) return latest;
              const latestDate = new Date(latest);
              const currentDate = new Date(current);
              return currentDate > latestDate ? current : latest;
            });
            mostRecentChange = recentTime ? (typeof recentTime === 'string' ? recentTime : recentTime.toISOString()) : mostRecentChange;
          }
        } catch (error) {
          console.warn(`Failed to get modification times for ${repo.name}:`, error);
        }
      }

      return {
        ...repo,
        gitBranch,
        isDirty,
        dirtyFileCount,
        mostRecentChange,
      };
    } catch (error) {
      console.warn(`Failed to get git info for ${repo.name}:`, error);
      return {
        ...repo,
        gitBranch: 'main',
        isDirty: false,
        dirtyFileCount: 0,
        mostRecentChange: repo.github?.lastCommit,
      };
    }
  }, []);

  // Load repositories and GitHub data
  const loadRepositories = useCallback(async () => {
    try {
      setLoading(true);

      // Load local repositories
      const repos = await AlexandriaService.getRepositories();

      // Enhance repositories with git information
      const enhancedRepos: EnhancedAlexandriaEntry[] = await Promise.all(
        repos.map(repo => enhanceRepositoryWithGitInfo(repo))
      );

      setRepositories(enhancedRepos);

      // If user is authenticated, fetch GitHub data
      if (isAuthenticated) {
        try {
          // Fetch GitHub organizations and user repositories in parallel
          const [githubOrgs, userRepos] = await Promise.all([
            GithubService.getUserOrganizations(),
            GithubService.getUserRepositories({ sort: 'pushed', direction: 'desc' })
          ]);

          setRemoteRepositories(userRepos);

          // Create organization info combining local and remote data
          const localGrouped = groupRepositoriesByOrganization(enhancedRepos);
          const allOrgs = new Map<string, OrganizationInfo>();

          // Add organizations from local repos
          localGrouped.organizations.forEach((org, key) => {
            allOrgs.set(key, org);
          });

          // Create a set of local repository identifiers for deduplication
          const localRepoIdentifiers = new Set<string>();
          enhancedRepos.forEach(repo => {
            // Add both owner/name and just name for matching
            if (repo.github?.owner) {
              localRepoIdentifiers.add(`${repo.github.owner}/${repo.name}`.toLowerCase());
            }
            // Also check remoteUrl for owner
            if (repo.remoteUrl) {
              const match = repo.remoteUrl.match(/github\.com[:/]([^/]+)\//);
              if (match) {
                localRepoIdentifiers.add(`${match[1]}/${repo.name}`.toLowerCase());
              }
            }
            localRepoIdentifiers.add(repo.name.toLowerCase());
          });

          // Count unique remote repositories by organization (excluding already cloned ones)
          const uniqueRemoteRepoCountByOrg = new Map<string, number>();
          userRepos.forEach(repo => {
            const orgName = repo.owner.login;
            const repoKey = `${orgName}/${repo.name}`.toLowerCase();

            // Only count if not already cloned locally
            const isAlreadyLocal = localRepoIdentifiers.has(repoKey) ||
                                  localRepoIdentifiers.has(repo.name.toLowerCase());

            if (!isAlreadyLocal) {
              uniqueRemoteRepoCountByOrg.set(orgName, (uniqueRemoteRepoCountByOrg.get(orgName) || 0) + 1);
            }
          });

          // Add GitHub organizations (even if they don't have local repos)
          githubOrgs.forEach(ghOrg => {
            const uniqueRemoteCount = uniqueRemoteRepoCountByOrg.get(ghOrg.login) || 0;

            if (!allOrgs.has(ghOrg.login)) {
              // Org doesn't have local repos, show remote count only
              allOrgs.set(ghOrg.login, {
                name: ghOrg.login,
                type: 'github',
                avatarUrl: ghOrg.avatar_url,
                repositoryCount: uniqueRemoteCount,
                lastActivity: null
              });
            } else {
              // Org has local repos, add unique remote count
              const org = allOrgs.get(ghOrg.login);
              if (org) {
                org.repositoryCount = (org.repositoryCount || 0) + uniqueRemoteCount;
              }
            }
          });

          // Add user's own repos section
          if (authUser) {
            const userOrgKey = authUser.login;
            const userUniqueRemoteCount = uniqueRemoteRepoCountByOrg.get(userOrgKey) || 0;

            if (!allOrgs.has(userOrgKey)) {
              // User doesn't have local repos, show remote count only
              allOrgs.set(userOrgKey, {
                name: userOrgKey,
                type: 'github',
                avatarUrl: authUser.avatarUrl || '',
                repositoryCount: userUniqueRemoteCount,
                lastActivity: null,
                isUser: true
              });
            } else {
              // User has local repos, add unique remote count
              const org = allOrgs.get(userOrgKey);
              if (org) {
                org.repositoryCount = (org.repositoryCount || 0) + userUniqueRemoteCount;
              }
            }
          }

          const sortedOrgs = sortOrganizations(Array.from(allOrgs.values()));
          setOrganizations(sortedOrgs);
          setRepositoriesByOrg(localGrouped.repositoriesByOrg as Map<string, EnhancedAlexandriaEntry[]>);
        } catch (error) {
          console.error('Failed to load GitHub data:', error);
        }
      } else {
        // Not authenticated, just use local repos
        const grouped = groupRepositoriesByOrganization(enhancedRepos);
        const sortedOrgs = sortOrganizations(Array.from(grouped.organizations.values()));
        setOrganizations(sortedOrgs);
        setRepositoriesByOrg(grouped.repositoriesByOrg as Map<string, EnhancedAlexandriaEntry[]>);
      }
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  }, [enhanceRepositoryWithGitInfo, isAuthenticated, authUser]);

  useEffect(() => {
    // Load panel preferences
    const loadPreferences = async () => {
      try {
        const preferences = await UserPreferencesService.getPreferences();
        if (preferences.panelLayouts?.authView?.sizes) {
          setPanelSizes(preferences.panelLayouts.authView.sizes);
        }
      } catch (err) {
        console.error('Failed to load panel preferences:', err);
      }
    };

    loadPreferences();
    loadRepositories();

    // Subscribe to repository changes
    const unsubscribe = AlexandriaService.onRepositoryChange(() => {
      loadRepositories();
    });

    return () => {
      unsubscribe();
    };
  }, [loadRepositories]);

  // Handle opening repository
  const handleOpenRepository = useCallback(async (repo: AlexandriaEntry | EnhancedAlexandriaEntry) => {
    await WindowService.openRepositoryDashboard(repo);
  }, []);

  // Get filtered repositories (local repos only, remote repos are passed separately)
  const getFilteredRepositories = useCallback(() => {
    if (selectedOrg === null) {
      // For "All Repositories", return all local repos
      return [...repositories].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
    }
    // For specific org, use the pre-sorted list of local repos
    return repositoriesByOrg.get(selectedOrg) || [];
  }, [selectedOrg, repositories, repositoriesByOrg]);

  // Toggle between auth and repository view
  const handleToggleAuthView = useCallback(() => {
    setShowAuthView(!showAuthView);
  }, [showAuthView]);

  // Render left panel - Organization sidebar with user header
  const renderLeftPanel = () => {
    return (
      <OrganizationSidebar
        organizations={organizations}
        selectedOrg={selectedOrg}
        onSelectOrg={setSelectedOrg}
        totalRepositories={(() => {
          // Calculate unique total count
          const localSet = new Set<string>();
          repositories.forEach(repo => {
            if (repo.github?.owner) {
              localSet.add(`${repo.github.owner}/${repo.name}`.toLowerCase());
            } else if (repo.remoteUrl) {
              const match = repo.remoteUrl.match(/github\.com[:/]([^/]+)\//);
              if (match) {
                localSet.add(`${match[1]}/${repo.name}`.toLowerCase());
              }
            }
            localSet.add(repo.name.toLowerCase());
          });

          let uniqueRemoteCount = 0;
          remoteRepositories.forEach(repo => {
            const key = `${repo.owner.login}/${repo.name}`.toLowerCase();
            if (!localSet.has(key) && !localSet.has(repo.name.toLowerCase())) {
              uniqueRemoteCount++;
            }
          });

          return repositories.length + uniqueRemoteCount;
        })()}
        isAuthenticated={isAuthenticated}
        user={authUser}
        showAuthView={showAuthView}
        onToggleAuthView={handleToggleAuthView}
      />
    );
  };

  // Render right panel - Either auth details or repository grid
  const renderRightPanel = () => {
    if (showAuthView) {
      return (
        <AuthDetails
          isAuthenticated={isAuthenticated}
          user={authUser}
          login={login}
          logout={logout}
          isLoggingIn={isLoggingIn || false}
          loginError={loginError || null}
          clearLoginError={clearLoginError}
        />
      );
    }

    return (
      <RepositoryGrid
        repositories={getFilteredRepositories()}
        remoteRepositories={remoteRepositories}
        selectedOrg={selectedOrg}
        loading={loading}
        onOpenRepository={handleOpenRepository}
      />
    );
  };

  return (
    <div
      className="auth-view"
      style={{
        height: '100%',
        backgroundColor,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }}
    >
      <AnimatedResizableLayout
        leftPanel={renderLeftPanel()}
        rightPanel={renderRightPanel()}
        minSize={20}
        defaultSize={panelState.type === 'two-panel' ? panelState.sizes.left : 25}
        collapsibleSide="left"
        collapsed={panelState.collapsed.left}
        style={{ height: '100%', width: '100%' }}
        theme={panelsTheme}
        onCollapseComplete={panelState.handleLeftCollapseComplete}
        onExpandComplete={panelState.handleLeftExpandComplete}
      />
    </div>
  );
};