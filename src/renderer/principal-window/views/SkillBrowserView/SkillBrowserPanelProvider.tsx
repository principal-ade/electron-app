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
import { LocalSkillsFileSystemAdapter } from './LocalSkillsFileSystemAdapter';

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

  // Track installed skills for LocalSkillsFileSystemAdapter
  const [installedSkills, setInstalledSkills] = useState<Array<{ path: string; name: string; source: string }>>([]);

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

  // Create Local skills file system adapter
  const localSkillsAdapter = useMemo(() => {
    if (installedSkills.length > 0) {
      return new LocalSkillsFileSystemAdapter(installedSkills);
    }
    return null;
  }, [installedSkills]);

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

  // Fetch installed skills on mount and when skill:installed event fires
  useEffect(() => {
    const fetchInstalledSkills = async () => {
      try {
        const result = await FileSystemService.getAllLocalSkills();
        if (result && result.skills) {
          console.info('[SkillBrowserPanelProvider] Fetched installed skills:', result.skills.length);
          setInstalledSkills(result.skills);
        }
      } catch (error) {
        console.error('[SkillBrowserPanelProvider] Failed to fetch installed skills:', error);
        setInstalledSkills([]);
      }
    };

    fetchInstalledSkills();

    // Listen for skill installation events to refresh
    const unsubscribe = events.on('skill:installed', () => {
      console.log('[SkillBrowserPanelProvider] Skill installed, refreshing installed skills');
      fetchInstalledSkills();
    });

    return unsubscribe;
  }, [events]);

  // Create adapters
  const adapters: PanelAdapters = useMemo(
    () => ({
      fileSystem: {
        readFile: async (filePath: string): Promise<string> => {
          console.log('[SkillBrowserPanelProvider] readFile called:', filePath);

          // If it's an absolute path (global skills), read directly
          if (filePath.startsWith('/') || filePath.startsWith('~')) {
            try {
              const result = await FileSystemService.readFile(filePath);
              if (!result || !result.content) {
                throw new Error('Failed to read file content');
              }
              return result.content;
            } catch (error) {
              console.error('[SkillBrowserPanelProvider] Failed to read file:', error);
              throw error;
            }
          }

          // Check if it's a virtual skill path (source/skill-name/file.md)
          // These paths don't start with / or ~ and typically have 3+ parts
          if (!filePath.startsWith('/') && !filePath.startsWith('~') && localSkillsAdapter) {
            const parts = filePath.split('/');
            // Virtual skill paths are: source/skill-name/file.md
            if (parts.length >= 3) {
              try {
                console.log('[SkillBrowserPanelProvider] Reading installed skill:', filePath);
                const content = await localSkillsAdapter.readFile(filePath);
                return content;
              } catch (error) {
                console.error('[SkillBrowserPanelProvider] Failed to read local skill:', error);
                // Fall through to try GitHub adapter
              }
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

          throw new Error('No suitable file system adapter available for path: ' + filePath);
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
    [githubAdapter, localSkillsAdapter],
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
              // Refresh is handled by skills:refresh event from SkillsListPanel
              // This is here for API compatibility but not actively used
              console.log('[SkillBrowserPanelProvider] fileTree refresh called (no-op)');
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
