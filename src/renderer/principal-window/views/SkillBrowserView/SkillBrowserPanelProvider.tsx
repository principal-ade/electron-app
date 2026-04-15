import React, { useMemo, useState, useEffect, type ReactNode } from 'react';
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
import type { FileTree } from '@principal-ai/repository-abstraction';
import { GitHubFileSystemAdapter } from './GitHubFileSystemAdapter';
import { LocalSkillsFileSystemAdapter } from './LocalSkillsFileSystemAdapter';

interface GitHubRepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

// Extended context type that includes typed slice properties for SkillsPanelContext
interface SkillBrowserContextValue extends PanelContextValue {
  fileTree: DataSlice<FileTree | null>;
  globalSkills: DataSlice<{ skills: GlobalSkill[] } | null>;
}

interface SkillBrowserPanelProviderValue {
  context: SkillBrowserContextValue;
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

// Create context
const SkillBrowserPanelContext = React.createContext<SkillBrowserPanelProviderValue | null>(null);

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
  const [fileTreeLoading, _setFileTreeLoading] = useState(false);

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

  // Fetch global skills on mount and when skills are installed/uninstalled
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

    // Listen for skill installation/uninstallation events to refresh global skills
    const unsubscribeInstalled = events.on('skill:installed', () => {
      console.info('[SkillBrowserPanelProvider] Skill installed, refreshing global skills');
      fetchGlobalSkills();
    });

    const unsubscribeUninstalled = events.on('skill:uninstalled', () => {
      console.info('[SkillBrowserPanelProvider] Skill uninstalled, refreshing global skills');
      fetchGlobalSkills();
    });

    return () => {
      unsubscribeInstalled();
      unsubscribeUninstalled();
    };
  }, [events]);

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
      console.info('[SkillBrowserPanelProvider] Skill installed, refreshing installed skills');
      fetchInstalledSkills();
    });

    return unsubscribe;
  }, [events]);

  // Create adapters
  const adapters: PanelAdapters = useMemo(
    () => ({
      fileSystem: {
        readFile: async (filePath: string): Promise<string> => {
          console.info('[SkillBrowserPanelProvider] readFile called:', filePath);

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
                console.info('[SkillBrowserPanelProvider] Reading installed skill:', filePath);
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
          console.info('[SkillBrowserPanelProvider] exists called:', filePath);
          return true;
        },
      },
    }),
    [githubAdapter, localSkillsAdapter],
  );

  // Create empty slices Map for backward compatibility
  const slices = useMemo<Map<string, DataSlice>>(() => new Map(), []);

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

  // Create typed slice objects for direct property access
  const fileTreeSlice: DataSlice<FileTree | null> = useMemo(
    () => ({
      scope: 'repository' as const,
      name: 'fileTree',
      data: fileTreeData,
      loading: fileTreeLoading,
      error: null,
      refresh: async () => {
        console.info('[SkillBrowserPanelProvider] fileTree refresh called (no-op)');
      },
    }),
    [fileTreeData, fileTreeLoading],
  );

  const globalSkillsSlice: DataSlice<{ skills: GlobalSkill[] } | null> = useMemo(
    () => ({
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
    }),
    [globalSkillsData, globalSkillsLoading],
  );

  // Create context value
  const context = useMemo(
    () => ({
      // Typed slice properties for direct access (SkillsPanelContext)
      fileTree: fileTreeSlice,
      globalSkills: globalSkillsSlice,
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
        workspace: undefined,
        repository: githubRepoInfo ? {
          path: `${githubRepoInfo.owner}/${githubRepoInfo.repo}`,
          name: githubRepoInfo.repo,
        } : undefined,
      },
      slices,
      adapters,
      isSliceLoading: (_name: string, _scope?: 'workspace' | 'repository'): boolean => {
        // Use typed slice properties directly (context.fileTree.loading, context.globalSkills.loading)
        return false;
      },
      refresh: async (_scope?: 'workspace' | 'repository', sliceName?: string): Promise<void> => {
        // Refresh specific slices based on name
        if (!sliceName || sliceName === 'globalSkills') {
          await globalSkillsSlice.refresh();
        }
        if (!sliceName || sliceName === 'fileTree') {
          await fileTreeSlice.refresh();
        }
      },
    }),
    [slices, adapters, githubRepoInfo, fileTreeSlice, globalSkillsSlice, globalSkillsLoading, fileTreeLoading],
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

// Hook to use the context
export const useSkillBrowserPanelProvider = (): SkillBrowserPanelProviderValue => {
  const context = React.useContext(SkillBrowserPanelContext);
  if (!context) {
    throw new Error('useSkillBrowserPanelProvider must be used within SkillBrowserPanelProvider');
  }
  return context;
};
