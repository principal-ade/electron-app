import React, { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react';
import { PanelEventBus } from '@principal-ade/panel-framework-core';
import type {
  PanelContextValue,
  PanelActions,
  DataSlice,
  PanelEvent,
  PanelEventEmitter,
  PanelAdapters,
} from '@principal-ade/panel-framework-core';
import { FileSystemService } from '../../../main-process-api/FileSystemService';
import type { GlobalSkill } from '../../../../shared/main-process-api-interfaces/FileSystemAPI';
import type { FileTree } from '../../../contexts/RepositoryPanelContext';
import { GitHubFileSystemAdapter } from './GitHubFileSystemAdapter';

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

interface SkillBrowserPanelProviderValue {
  context: PanelContextValue;
  actions: PanelActions & {
    setFileTree: (tree: FileTree | null) => void;
    setGitHubRepository: (info: GitHubRepoInfo | null) => void;
  };
  events: PanelEventEmitter;
}

interface SkillBrowserPanelProviderProps {
  children: ReactNode;
  events: PanelEventEmitter;
}

/**
 * Simplified panel provider for the Skill Browser view
 * Only provides global skills data without repository-specific logic
 */
export const SkillBrowserPanelProvider: React.FC<
  SkillBrowserPanelProviderProps
> = ({ children, events }) => {
  // Track global skills
  const [globalSkillsData, setGlobalSkillsData] = useState<GlobalSkill[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(false);

  // Track file tree from GitHub
  const [fileTreeData, setFileTreeData] = useState<FileTree | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);

  // Track GitHub repository info
  const [githubRepoInfo, setGithubRepoInfo] = useState<GitHubRepoInfo | null>(null);

  // Create GitHub file system adapter
  const githubAdapter = useMemo(() => {
    if (githubRepoInfo) {
      return new GitHubFileSystemAdapter(
        githubRepoInfo.owner,
        githubRepoInfo.repo,
        githubRepoInfo.branch,
      );
    }
    return null;
  }, [githubRepoInfo]);

  // Fetch global skills on mount
  useEffect(() => {
    const fetchGlobalSkills = async () => {
      setGlobalSkillsLoading(true);
      try {
        const skills = await FileSystemService.getGlobalSkills();
        console.info('[SkillBrowserPanelProvider] Fetched global skills:', skills.length);
        setGlobalSkillsData(skills);
      } catch (error) {
        console.error('[SkillBrowserPanelProvider] Failed to fetch global skills:', error);
        setGlobalSkillsData([]);
      } finally {
        setGlobalSkillsLoading(false);
      }
    };

    fetchGlobalSkills();
  }, []);

  // Create adapters
  const adapters: PanelAdapters = useMemo(
    () => ({
      fileSystem: {
        readFile: async (filePath: string): Promise<string> => {
          console.log('[SkillBrowserPanelProvider] readFile called:', filePath);

          // If it's an absolute path (global skills), read directly
          if (filePath.startsWith('/') || filePath.startsWith('~')) {
            try {
              const content = await FileSystemService.readFile(filePath);
              return content;
            } catch (error) {
              console.error('[SkillBrowserPanelProvider] Failed to read file:', error);
              throw error;
            }
          }

          // For GitHub files, use the GitHub adapter
          if (githubAdapter) {
            try {
              const content = await githubAdapter.readFile(filePath);
              return content;
            } catch (error) {
              console.error('[SkillBrowserPanelProvider] Failed to read GitHub file:', error);
              throw error;
            }
          }

          throw new Error('GitHub repository not configured. Please fetch a repository first.');
        },
        writeFile: async () => {
          throw new Error('File writing not supported in Skill Browser');
        },
        deleteFile: async () => {
          throw new Error('File deletion not supported in Skill Browser');
        },
        exists: async (filePath: string): Promise<boolean> => {
          // For GitHub files, we can't check existence without making an API call
          // For now, just return true and let readFile handle the error
          console.log('[SkillBrowserPanelProvider] exists called:', filePath);
          return true;
        },
      },
    }),
    [githubAdapter],
  );

  // Create data slices
  const slices = useMemo<Map<string, DataSlice>>(
    () =>
      new Map([
        [
          'fileTree',
          {
            scope: 'repository' as const,
            name: 'fileTree',
            data: fileTreeData,
            loading: fileTreeLoading,
            error: null,
            refresh: async () => {
              // No automatic refresh for GitHub file tree
              // Must be manually fetched via setFileTree action
            },
          },
        ],
        [
          'globalSkills',
          {
            scope: 'workspace' as const,
            name: 'globalSkills',
            data: { skills: globalSkillsData },
            loading: globalSkillsLoading,
            error: null,
            refresh: async () => {
              setGlobalSkillsLoading(true);
              try {
                const skills = await FileSystemService.getGlobalSkills();
                setGlobalSkillsData(skills);
              } catch (error) {
                console.error('[SkillBrowserPanelProvider] Failed to refresh global skills:', error);
              } finally {
                setGlobalSkillsLoading(false);
              }
            },
          },
        ],
      ]),
    [fileTreeData, fileTreeLoading, globalSkillsData, globalSkillsLoading],
  );

  // Create actions
  const actions = useMemo(
    () => ({
      notifyPanels: (event: PanelEvent) => {
        events.emit(event);
      },
      setFileTree: (tree: FileTree | null) => {
        console.info('[SkillBrowserPanelProvider] Setting file tree:', tree);
        setFileTreeData(tree);
      },
      setGitHubRepository: (info: GitHubRepoInfo | null) => {
        console.info('[SkillBrowserPanelProvider] Setting GitHub repository:', info);
        setGithubRepoInfo(info);
      },
    }),
    [events],
  );

  // Create context value
  const context = useMemo(
    () => ({
      // Repository-like properties for compatibility with skills panels
      // Use owner/repo as the path when browsing GitHub
      repositoryPath: githubRepoInfo ? `${githubRepoInfo.owner}/${githubRepoInfo.repo}` : null,
      repository: githubRepoInfo ? {
        path: `${githubRepoInfo.owner}/${githubRepoInfo.repo}`,
        name: githubRepoInfo.repo,
        owner: githubRepoInfo.owner,
        branch: githubRepoInfo.branch,
      } : null,
      loading: globalSkillsLoading || fileTreeLoading,

      // PanelContextValue properties
      currentScope: {
        type: githubRepoInfo ? 'repository' as const : 'workspace' as const,
        workspace: null,
        repository: githubRepoInfo ? {
          path: `${githubRepoInfo.owner}/${githubRepoInfo.repo}`,
          name: githubRepoInfo.repo,
        } : undefined,
      },
      slices,
      adapters,
      getSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        return slices.get(name) as DataSlice<T> | undefined;
      },
      getWorkspaceSlice: <T = unknown,>(name: string): DataSlice<T> | undefined => {
        const slice = slices.get(name);
        return slice?.scope === 'workspace' ? (slice as DataSlice<T>) : undefined;
      },
      getRepositorySlice: () => undefined,
      hasSlice: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        return scope ? slice.scope === scope : true;
      },
      isSliceLoading: (name: string, scope?: 'workspace' | 'repository'): boolean => {
        const slice = slices.get(name);
        if (!slice) return false;
        if (scope && slice.scope !== scope) return false;
        return slice.loading;
      },
      refresh: async (scope?: 'workspace' | 'repository', sliceName?: string): Promise<void> => {
        const slicesToRefresh = Array.from(slices.values()).filter((slice) => {
          if (scope && slice.scope !== scope) return false;
          if (sliceName && slice.name !== sliceName) return false;
          return true;
        });

        await Promise.all(slicesToRefresh.map((slice) => slice.refresh()));
      },
    }),
    [slices, adapters, globalSkillsLoading, fileTreeLoading, githubRepoInfo],
  );

  // Provider value
  const value: SkillBrowserPanelProviderValue = useMemo(
    () => ({
      context,
      actions,
      events,
    }),
    [context, actions, events],
  );

  return (
    <SkillBrowserPanelContext.Provider value={value}>
      {children}
    </SkillBrowserPanelContext.Provider>
  );
};

// Create context
const SkillBrowserPanelContext = React.createContext<SkillBrowserPanelProviderValue | null>(null);

// Hook to use the context
export const useSkillBrowserPanelProvider = (): SkillBrowserPanelProviderValue => {
  const context = React.useContext(SkillBrowserPanelContext);
  if (!context) {
    throw new Error('useSkillBrowserPanelProvider must be used within SkillBrowserPanelProvider');
  }
  return context;
};
