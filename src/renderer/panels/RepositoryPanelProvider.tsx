import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../shared/types/repository.types';
import type {
  RepositoryCacheData,
  MarkdownFile,
  QualityMetrics,
} from '../services/RepositoryDataCache';
import type { FileTree } from '@principal-ai/repository-abstraction';
import type { PackageLayer } from '@principal-ai/codebase-composition';
import type {
  GitStatusWithFiles,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { useRepositoryData } from '../hooks/useRepositoryData';

export type RepositoryPanelSlice =
  | 'git'
  | 'markdown'
  | 'fileTree'
  | 'packages'
  | 'quality';

export interface RepositoryPanelActions {
  openFile?: (filePath: string) => void;
}

export interface RepositoryPanelContextValue {
  repositoryPath: string | null;
  repository: EnhancedAlexandriaEntry | null;
  gitStatus: GitStatus;
  gitStatusLoading: boolean;
  markdownFiles: MarkdownFile[];
  fileTree: FileTree | null;
  packages: PackageLayer[] | null;
  quality: QualityMetrics | null;
  loading: boolean;
  refresh: () => Promise<void>;
  actions: RepositoryPanelActions;
  hasSlice: (slice: RepositoryPanelSlice) => boolean;
  isSliceLoading: (slice: RepositoryPanelSlice) => boolean;
}

interface RepositoryPanelProviderProps {
  repositoryPath: string | null;
  initialData?: RepositoryCacheData | null;
  actions?: RepositoryPanelActions;
  children: React.ReactNode;
}

const RepositoryPanelContext =
  createContext<RepositoryPanelContextValue | null>(null);

const emptyGitStatus: GitStatus = {
  staged: [],
  unstaged: [],
  untracked: [],
  deleted: [],
};

function mapGitStatus(status: GitStatusWithFiles | null): GitStatus | null {
  if (!status) {
    return null;
  }

  const toEntries = (files: string[]) => files.map((path) => ({ path }));

  return {
    staged: toEntries(status.stagedFiles),
    unstaged: toEntries(status.modifiedFiles),
    untracked: toEntries(status.untrackedFiles),
    deleted: toEntries(status.deletedFiles),
  };
}

export const RepositoryPanelProvider: React.FC<RepositoryPanelProviderProps> = ({
  repositoryPath,
  initialData = null,
  actions,
  children,
}) => {
  const {
    data,
    loading,
    refresh: refreshFromCache,
  } = useRepositoryData(repositoryPath, {
    autoLoad: !initialData,
    subscribe: true,
  });

  const effectiveData = data ?? initialData ?? null;
  const gitStatus = useMemo(
    () => mapGitStatus(effectiveData?.gitStatus ?? null),
    [effectiveData?.gitStatus],
  );
  const hasGitData = !!effectiveData?.gitStatus;

  const gitStatusLoading = useMemo(() => {
    if (!repositoryPath) {
      return false;
    }
    if (hasGitData) {
      return false;
    }
    return loading;
  }, [hasGitData, loading, repositoryPath]);

  const refresh = useCallback(async () => {
    const result = refreshFromCache();
    if (result && typeof (result as Promise<void>).then === 'function') {
      await result;
    }
  }, [refreshFromCache]);

  const contextValue = useMemo<RepositoryPanelContextValue>(() => {
    const markdownFiles = effectiveData?.markdownFiles ?? [];
    const fileTree = effectiveData?.fileTree ?? null;
    const packages = effectiveData?.packages ?? null;
    const quality = effectiveData?.qualityMetrics ?? null;

    const hasSlice = (slice: RepositoryPanelSlice) => {
      switch (slice) {
        case 'git':
          return hasGitData;
        case 'markdown':
          return markdownFiles.length > 0;
        case 'fileTree':
          return !!fileTree;
        case 'packages':
          return !!packages && packages.length > 0;
        case 'quality':
          return !!quality;
        default:
          return false;
      }
    };

    const isSliceLoading = (slice: RepositoryPanelSlice) => {
      switch (slice) {
        case 'git':
          return gitStatusLoading;
        case 'markdown':
        case 'fileTree':
        case 'packages':
        case 'quality':
          return loading && !hasSlice(slice);
        default:
          return false;
      }
    };

    return {
      repositoryPath,
      repository: effectiveData?.repository ?? null,
      gitStatus: gitStatus ?? emptyGitStatus,
      gitStatusLoading,
      markdownFiles,
      fileTree,
      packages,
      quality,
      loading,
      refresh,
      actions: actions ?? {},
      hasSlice,
      isSliceLoading,
    };
  }, [
    actions,
    effectiveData,
    gitStatus,
    hasGitData,
    gitStatusLoading,
    loading,
    refresh,
    repositoryPath,
  ]);

  return (
    <RepositoryPanelContext.Provider value={contextValue}>
      {children}
    </RepositoryPanelContext.Provider>
  );
};

export function useRepositoryPanelContext(): RepositoryPanelContextValue {
  const context = useContext(RepositoryPanelContext);
  if (!context) {
    throw new Error(
      'useRepositoryPanelContext must be used within a RepositoryPanelProvider',
    );
  }
  return context;
}
