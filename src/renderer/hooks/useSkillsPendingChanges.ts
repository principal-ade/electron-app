import { useState, useEffect, useCallback } from 'react';
import { FileSystemService } from '../main-process-api/FileSystemService';

/**
 * Pending change for a single skill file
 */
export interface SkillChange {
  path: string;
  type: string;
}

/**
 * Pending changes for a directory
 * Matches the structure returned by GET_PENDING_CHANGES
 */
export interface PendingDirectoryChanges {
  directoryId: string;
  changes: SkillChange[];
  lastDetected: Date;
}

export interface UseSkillsPendingChangesReturn {
  // State
  pendingChanges: Map<string, PendingDirectoryChanges>;
  hasPendingChanges: boolean;
  totalPendingCount: number;
  isLoading: boolean;
  error: string | null;

  // Actions
  getPendingChanges: () => Promise<void>;
  clearPendingChanges: (directoryId: string) => Promise<boolean>;
}

/**
 * Hook for managing pending skills changes from watched clone directories
 * Listens for file change events and provides UI with pending changes state
 */
export function useSkillsPendingChanges(): UseSkillsPendingChangesReturn {
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, PendingDirectoryChanges>
  >(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial pending changes
  const getPendingChanges = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await FileSystemService.getPendingChanges();

      if (Array.isArray(result)) {
        const changesMap = new Map<string, PendingDirectoryChanges>();
        result.forEach((item: PendingDirectoryChanges) => {
          changesMap.set(item.directoryId, {
            ...item,
            lastDetected: new Date(item.lastDetected),
          });
        });
        setPendingChanges(changesMap);
      }
    } catch (err) {
      console.error('[useSkillsPendingChanges] Error loading pending changes:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending changes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    getPendingChanges();
  }, [getPendingChanges]);

  // Listen for pending changes updates from main process
  useEffect(() => {
    const handlePendingChangesUpdated = (
      event: {
        directoryId: string;
        changes: {
          changes: Array<{ path: string; type: string }>;
          lastDetected: Date;
        };
      },
    ) => {
      console.info('[useSkillsPendingChanges] Received pending changes update:', event);

      setPendingChanges((prev) => {
        const next = new Map(prev);
        next.set(event.directoryId, {
          directoryId: event.directoryId,
          changes: event.changes.changes,
          lastDetected: new Date(event.changes.lastDetected),
        });
        return next;
      });
    };

    // Subscribe to pending changes updates
    const unsubscribe = FileSystemService.onPendingChangesUpdated(handlePendingChangesUpdated);

    return () => {
      unsubscribe();
    };
  }, []);

  // Clear pending changes for a directory
  const clearPendingChanges = useCallback(
    async (directoryId: string): Promise<boolean> => {
      try {
        setError(null);

        const result = await FileSystemService.clearPendingChanges(directoryId);

        if (result?.success) {
          setPendingChanges((prev) => {
            const next = new Map(prev);
            next.delete(directoryId);
            return next;
          });
          return true;
        }

        return false;
      } catch (err) {
        console.error('[useSkillsPendingChanges] Error clearing pending changes:', err);
        setError(err instanceof Error ? err.message : 'Failed to clear pending changes');
        return false;
      }
    },
    [],
  );

  // Computed values
  const hasPendingChanges = pendingChanges.size > 0;
  const totalPendingCount = Array.from(pendingChanges.values()).reduce(
    (sum, dir) => sum + dir.changes.length,
    0,
  );

  return {
    pendingChanges,
    hasPendingChanges,
    totalPendingCount,
    isLoading,
    error,
    getPendingChanges,
    clearPendingChanges,
  };
}
