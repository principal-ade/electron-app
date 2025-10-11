import React, { useEffect, useMemo, useState } from 'react';

import { CustomThemeProvider } from '../providers/CustomThemeProvider';
import { GlobalFeedbackProvider } from '../GlobalFeedbackProvider';
import { UserPromptProvider } from '../components/mcp/UserPromptProvider';
import { AppVersionManagerService } from '../main-process-api/AppVersionManagerService';
import type { Repository } from '../../shared/types/repository.types';
import { RepositoryWorkspace } from './RepositoryWorkspace';

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
  const repository = windowData?.repository ?? null;
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);

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
        <UserPromptProvider>{content}</UserPromptProvider>
      </GlobalFeedbackProvider>
    </CustomThemeProvider>
  );
};
