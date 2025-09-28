import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'themed-markdown';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import { useAuthState } from '../../../hooks/useAuthState';
import type { AlexandriaEntry } from '@a24z/core-library';
import type { EnhancedAlexandriaEntry } from '../../../../shared/types/repository.types';
import { AlexandriaService } from '../../../main-process-api/AlexandriaService';
import { GitService } from '../../../main-process-api/GitService';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import { WindowService } from '../../../main-process-api/WindowService';
import { OrganizationSidebar } from './components/OrganizationSidebar';
import { RepositoryGrid } from './components/RepositoryGrid';
import { AuthDetails } from './components/AuthDetails';
import {
  groupRepositoriesByOrganization,
  sortOrganizations,
  type OrganizationInfo,
} from './utils/repositoryOrganizer';
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
  const [organizations, setOrganizations] = useState<OrganizationInfo[]>([]);
  const [repositoriesByOrg, setRepositoriesByOrg] = useState<Map<string, EnhancedAlexandriaEntry[]>>(new Map());
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthView, setShowAuthView] = useState(false);

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

  // Load repositories
  const loadRepositories = useCallback(async () => {
    try {
      setLoading(true);
      const repos = await AlexandriaService.getRepositories();

      // Enhance repositories with git information
      const enhancedRepos: EnhancedAlexandriaEntry[] = await Promise.all(
        repos.map(repo => enhanceRepositoryWithGitInfo(repo))
      );

      setRepositories(enhancedRepos);

      // Group repositories by organization
      const grouped = groupRepositoriesByOrganization(enhancedRepos);
      const sortedOrgs = sortOrganizations(Array.from(grouped.organizations.values()));

      setOrganizations(sortedOrgs);
      setRepositoriesByOrg(grouped.repositoriesByOrg as Map<string, EnhancedAlexandriaEntry[]>);
    } catch (err) {
      console.error('Failed to load repositories:', err);
    } finally {
      setLoading(false);
    }
  }, [enhanceRepositoryWithGitInfo]);

  useEffect(() => {
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

  // Get filtered repositories
  const getFilteredRepositories = useCallback(() => {
    if (selectedOrg === null) {
      // For "All Repositories", sort by name only
      return [...repositories].sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
    }
    // For specific org, use the pre-sorted list
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
        totalRepositories={repositories.length}
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
        defaultSize={25}
        collapsibleSide="left"
        style={{ height: '100%', width: '100%' }}
        theme={panelsTheme}
      />
    </div>
  );
};