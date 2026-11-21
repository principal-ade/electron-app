import { useEffect, useState } from 'react';
import type { CityData } from '@principal-ai/file-city-react';

import { RepositoryMonitoringService } from '../../main-process-api/RepositoryMonitoringService';
import { buildCityDataFromContext } from '../file-city-panel/buildCityDataFromContext';

export interface WorkspaceCityState {
  cityData: CityData | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Load the File City for a workspace. Kept in the ACP session so the
 * side-panel map and the expanded activity map share one build.
 */
export function useWorkspaceCity(
  workspacePath: string | null | undefined,
): WorkspaceCityState {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(workspacePath));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspacePath) {
      setCityData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setCityData(null);
    setIsLoading(true);
    setError(null);

    void (async () => {
      try {
        const fileTree =
          await RepositoryMonitoringService.getFileTree(workspacePath);
        if (!fileTree) throw new Error('No file tree is available');
        const nextCityData = await buildCityDataFromContext({
          fileTree,
          repositoryPath: workspacePath,
        });
        if (!cancelled) setCityData(nextCityData);
      } catch (loadError: unknown) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load this workspace File City',
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  return { cityData, isLoading, error };
}
