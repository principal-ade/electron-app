import { useState, useEffect, useCallback, useMemo } from 'react';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type {
  GitStatus,
  GitStatusWithFiles,
} from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

/**
 * Hook to get git status with file lists from the repository monitoring service
 * @param repoPath - Path to the repository
 * @returns Git status with file lists and utility functions
 */
export function useRepositoryGitStatus(repoPath: string | null) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitStatusWithFiles, setGitStatusWithFiles] =
    useState<GitStatusWithFiles | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize all modified files to prevent unnecessary re-renders
  const allModifiedFiles = useMemo(() => {
    return gitStatusWithFiles
      ? [
          ...gitStatusWithFiles.modifiedFiles,
          ...gitStatusWithFiles.createdFiles,
          ...gitStatusWithFiles.deletedFiles,
        ]
      : [];
  }, [gitStatusWithFiles]);

  // Load initial git status - use useRef pattern to avoid infinite loops
  const loadGitStatus = useCallback(async () => {
    if (!repoPath) {
      setGitStatus(null);
      setGitStatusWithFiles(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get both basic status and status with files
      const [basicStatus, statusWithFiles] = await Promise.all([
        RepositoryMonitoringService.getGitStatus(repoPath),
        RepositoryMonitoringService.getGitStatusWithFiles(repoPath),
      ]);

      setGitStatus(basicStatus);
      setGitStatusWithFiles(statusWithFiles);
    } catch (err) {
      console.error('[useRepositoryGitStatus] Error loading git status:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load git status',
      );
    } finally {
      setLoading(false);
    }
  }, [repoPath]);

  // Load on mount and when repo path changes
  useEffect(() => {
    loadGitStatus();
  }, [loadGitStatus]);

  // Subscribe to git status changes
  useEffect(() => {
    if (!repoPath) return;

    // Subscribe to git status changes from monitoring service
    const unsubscribe =
      window.mainProcess.repositoryMonitoring.onGitStatusChanged(
        async (status: GitStatus) => {
          // Only update if the status is for our repository
          if (status.repoPath === repoPath) {
            setGitStatus(status);

            // Fetch the detailed status with files
            try {
              const statusWithFiles =
                await RepositoryMonitoringService.getGitStatusWithFiles(
                  repoPath,
                );
              setGitStatusWithFiles(statusWithFiles);
            } catch (err) {
              console.error(
                '[useRepositoryGitStatus] Error fetching updated status with files:',
                err,
              );
            }
          }
        },
      );

    return () => {
      unsubscribe();
    };
  }, [repoPath]);

  // Refresh function
  const refresh = useCallback(() => {
    return loadGitStatus();
  }, [loadGitStatus]);

  // Memoize individual file arrays to prevent unnecessary re-renders
  const modifiedFiles = useMemo(
    () => gitStatusWithFiles?.modifiedFiles || [],
    [gitStatusWithFiles],
  );
  const untrackedFiles = useMemo(
    () => gitStatusWithFiles?.untrackedFiles || [],
    [gitStatusWithFiles],
  );
  const stagedFiles = useMemo(
    () => gitStatusWithFiles?.stagedFiles || [],
    [gitStatusWithFiles],
  );
  const createdFiles = useMemo(
    () => gitStatusWithFiles?.createdFiles || [],
    [gitStatusWithFiles],
  );
  const deletedFiles = useMemo(
    () => gitStatusWithFiles?.deletedFiles || [],
    [gitStatusWithFiles],
  );

  return {
    gitStatus,
    gitStatusWithFiles,
    modifiedFiles,
    untrackedFiles,
    stagedFiles,
    createdFiles,
    deletedFiles,
    allModifiedFiles,
    loading,
    error,
    refresh,
  };
}
