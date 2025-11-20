import React, { useEffect, useMemo, useState } from 'react';

import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { AppVersionManagerService } from '../main-process-api/AppVersionManagerService';
import { RepositoryService } from '../main-process-api/RepositoryService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type { Repository } from '../../shared/types/repository.types';
import { RepositoryWorkspace } from './RepositoryWorkspace';
import type { GitStatus } from '../../main/services/GitStatusService';

interface RepoManagerWindowData {
  repository?: Repository;
  mode?: string;
  [key: string]: unknown;
}

const HASH_PREFIXES = [
  '#repository-maps/',
  '#repository-manager/',
  '#repo-manager/',
];

function parseWindowDataFromHash(): RepoManagerWindowData | null {
  const { hash } = window.location;
  if (!hash) {
    return null;
  }

  for (const prefix of HASH_PREFIXES) {
    if (hash.startsWith(prefix)) {
      const encodedPayload = hash.substring(prefix.length);
      if (!encodedPayload) {
        return null;
      }

      try {
        const decoded = decodeURIComponent(encodedPayload);
        const payload = JSON.parse(decoded) as RepoManagerWindowData;
        return payload;
      } catch (error) {
        console.error('[RepoManagerApp] Failed to parse hash payload:', error);
        return null;
      }
    }
  }

  // Support hashes that contain JSON without a prefix
  if (hash.startsWith('#%7B') || hash.startsWith('#{')) {
    try {
      const decoded = decodeURIComponent(hash.substring(1));
      const payload = JSON.parse(decoded) as RepoManagerWindowData;
      return payload;
    } catch (error) {
      console.error(
        '[RepoManagerApp] Failed to parse unprefixed hash payload:',
        error,
      );
    }
  }

  return null;
}

function useWindowData(): RepoManagerWindowData | null {
  const [windowData, setWindowData] = useState<RepoManagerWindowData | null>(
    () => {
      return parseWindowDataFromHash();
    },
  );

  useEffect(() => {
    const handleHashChange = () => {
      setWindowData(parseWindowDataFromHash());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    (
      window as unknown as { windowInitData?: RepoManagerWindowData | null }
    ).windowInitData = windowData;
  }, [windowData]);

  return windowData;
}

export const RepoManagerApp: React.FC = () => {
  const windowData = useWindowData();
  const initialRepository = windowData?.repository ?? null;
  const [repository, setRepository] = useState<Repository | null>(
    initialRepository,
  );
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);

  // Update repository state when windowData changes
  useEffect(() => {
    setRepository(initialRepository);
  }, [initialRepository]);

  // Listen to git status changes to update branch info
  useEffect(() => {
    if (!repository?.remoteUrl || !repository.localClones?.length) return;

    const localClonePath = repository.localClones[0]?.path;
    if (!localClonePath) return;

    console.log(
      '[RepoManagerApp] Subscribing to git changes for:',
      localClonePath,
    );

    // Subscribe to cache sync events for git status changes
    const unsubscribe = RepositoryMonitoringService.onCacheSync((event) => {
      // Only handle gitStatus slice changes for our repository
      if (
        event.slice === 'gitStatus' &&
        event.repoPath === localClonePath &&
        event.entry.data &&
        'branch' in event.entry.data
      ) {
        const gitStatus = event.entry.data;
        const newBranch = gitStatus.branch;

        console.log(
          '[RepoManagerApp] Git status changed, branch:',
          newBranch,
        );

        // Update the repository's local clone branch info
        setRepository((prevRepo) => {
          if (!prevRepo) return prevRepo;

          const updatedClones = prevRepo.localClones.map((clone) => {
            if (clone.path === localClonePath) {
              return { ...clone, currentBranch: newBranch };
            }
            return clone;
          });

          return {
            ...prevRepo,
            localClones: updatedClones,
          };
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [repository?.remoteUrl, repository?.localClones]);

  useEffect(() => {
    const unsubscribeAvailable = AppVersionManagerService.onUpdateAvailable(
      () => {
        setHasUpdateAvailable(true);
      },
    );
    const unsubscribeNotAvailable =
      AppVersionManagerService.onUpdateNotAvailable(() => {
        setHasUpdateAvailable(false);
      });

    AppVersionManagerService.checkForUpdateSilently();

    return () => {
      unsubscribeAvailable?.();
      unsubscribeNotAvailable?.();
    };
  }, []);

  const content = useMemo(() => {
    if (!repository) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '14px',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          Unable to load repository details for this window.
        </div>
      );
    }

    return (
      <RepositoryWorkspace
        repository={repository}
        onBack={() => window.close()}
        hasUpdateAvailable={hasUpdateAvailable}
      />
    );
  }, [hasUpdateAvailable, repository]);

  return (
    <CustomThemeProvider>
      <GlobalFeedbackProvider>
        {content}
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
