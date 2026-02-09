import { useState, useEffect, useCallback } from 'react';
import { type SkillsRepoConfig, type SyncState } from '../../shared/main-process-api-interfaces/FileSystemAPI';
import { FileSystemService } from '../main-process-api/FileSystemService';

interface LocalSkill {
  path: string;
  name: string;
  source: 'agents' | 'claude';
}

interface UseSkillsSyncReturn {
  // State
  config: SkillsRepoConfig | null;
  syncState: SyncState | null;
  isLoading: boolean;
  error: string | null;

  // Config status
  isConfigured: boolean;
  isEnabled: boolean;

  // Actions
  getConfig: () => Promise<SkillsRepoConfig | null>;
  updateConfig: (updates: Partial<SkillsRepoConfig>) => Promise<SkillsRepoConfig | null>;
  sync: () => Promise<boolean>;
  getSyncStatus: () => Promise<SyncState | null>;

  // Onboarding actions
  getAllLocalSkills: () => Promise<LocalSkill[]>;
  initializeRepo: (repoUrl?: string) => Promise<boolean>;
  migrateSkills: (skillPaths: string[]) => Promise<boolean>;

  // Skill-level actions
  enableSkillSync: (skillPath: string, syncSource: 'git-global' | 'github') => Promise<boolean>;
  disableSkillSync: (skillPath: string) => Promise<boolean>;
  resolveConflict: (skillPath: string, resolution: 'keep-local' | 'use-remote') => Promise<boolean>;
}

/**
 * Hook for managing skills Git synchronization
 * Provides access to sync configuration, state, and actions
 */
export function useSkillsSync(): UseSkillsSyncReturn {
  const [config, setConfig] = useState<SkillsRepoConfig | null>(null);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial config and sync state
  useEffect(() => {
    loadConfig();
    loadSyncStatus();
  }, [loadConfig, loadSyncStatus]);

  const loadConfig = useCallback(async () => {
    try {
      const result = await FileSystemService.getSyncConfig();
      setConfig(result);
    } catch (err) {
      console.error('[useSkillsSync] Failed to load config:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const result = await FileSystemService.getSyncStatus();
      setSyncState(result);
    } catch (err) {
      console.error('[useSkillsSync] Failed to load sync status:', err);
    }
  }, []);

  const getConfig = useCallback(async (): Promise<SkillsRepoConfig | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.getSyncConfig();
      setConfig(result);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to get config:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (updates: Partial<SkillsRepoConfig>): Promise<SkillsRepoConfig | null> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.updateSyncConfig(updates);
      if (result) {
        setConfig(result);
      }
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to update config:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sync = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.syncGlobalSkills();
      await loadSyncStatus(); // Refresh sync status
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to sync:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadSyncStatus]);

  const getSyncStatus = useCallback(async (): Promise<SyncState | null> => {
    try {
      const result = await FileSystemService.getSyncStatus();
      setSyncState(result);
      return result;
    } catch (err) {
      console.error('[useSkillsSync] Failed to get sync status:', err);
      return null;
    }
  }, []);

  const getAllLocalSkills = useCallback(async (): Promise<LocalSkill[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.getAllLocalSkills();
      return result?.skills || [];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to get local skills:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const initializeRepo = useCallback(async (repoUrl?: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.initializeSkillsRepo(repoUrl);
      if (result?.success) {
        await loadConfig(); // Refresh config
      }
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to initialize repo:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadConfig]);

  const migrateSkills = useCallback(async (skillPaths: string[]): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await FileSystemService.migrateSkillsToRepo(skillPaths);
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to migrate skills:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const enableSkillSync = useCallback(async (skillPath: string, syncSource: 'git-global' | 'github'): Promise<boolean> => {
    try {
      setError(null);
      const result = await FileSystemService.enableSkillSync(skillPath, syncSource);
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to enable skill sync:', err);
      return false;
    }
  }, []);

  const disableSkillSync = useCallback(async (skillPath: string): Promise<boolean> => {
    try {
      setError(null);
      const result = await FileSystemService.disableSkillSync(skillPath);
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to disable skill sync:', err);
      return false;
    }
  }, []);

  const resolveConflict = useCallback(async (skillPath: string, resolution: 'keep-local' | 'use-remote'): Promise<boolean> => {
    try {
      setError(null);
      const result = await FileSystemService.resolveSkillConflict(skillPath, resolution);
      await loadSyncStatus(); // Refresh sync status
      return result?.success || false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      console.error('[useSkillsSync] Failed to resolve conflict:', err);
      return false;
    }
  }, [loadSyncStatus]);

  const isConfigured = config !== null && config.repoUrl.length > 0;
  const isEnabled = config !== null && config.enabled;

  return {
    config,
    syncState,
    isLoading,
    error,
    isConfigured,
    isEnabled,
    getConfig,
    updateConfig,
    sync,
    getSyncStatus,
    getAllLocalSkills,
    initializeRepo,
    migrateSkills,
    enableSkillSync,
    disableSkillSync,
    resolveConflict,
  };
}
