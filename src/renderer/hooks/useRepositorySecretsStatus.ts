import { useCallback, useEffect, useState } from 'react';

import { SecretsService } from '../main-process-api/SecretsService';

interface UseRepositorySecretsStatusOptions {
  /**
   * Skip all checks even if a repoId is provided. Useful when the panel is hidden.
   */
  skip?: boolean;
}

interface UseRepositorySecretsStatusResult {
  /**
   * True when the repository has at least one stored secret.
   */
  isConfigured: boolean;
  /**
   * Indicates whether a verification request is currently in flight.
   */
  isLoading: boolean;
  /**
   * Present when the verification request failed.
   */
  error: string | null;
  /**
   * Whether the hook has attempted to verify the secrets state for the active repository.
   */
  hasChecked: boolean;
  /**
   * Forces the hook to re-evaluate the secrets state for the current repository.
   */
  refresh: () => Promise<void>;
}

/**
 * React hook that evaluates whether a repository has secrets configured.
 * The verification is delegated to the renderer-side SecretsService, which
 * invokes the main process through IPC.
 */
export function useRepositorySecretsStatus(
  repoId: string | null | undefined,
  options: UseRepositorySecretsStatusOptions = {},
): UseRepositorySecretsStatusResult {
  const skipChecks = options.skip ?? false;

  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (skipChecks) {
      return;
    }

    if (!repoId) {
      setIsConfigured(false);
      setError(null);
      setHasChecked(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const exists = await SecretsService.exists(repoId);
      setIsConfigured(Boolean(exists));
    } catch (err) {
      console.error(
        '[useRepositorySecretsStatus] Failed to verify secrets configuration:',
        err,
      );
      setIsConfigured(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to verify repository secrets',
      );
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  }, [repoId, skipChecks]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isConfigured,
    isLoading,
    error,
    hasChecked,
    refresh,
  };
}
