import { useState, useEffect } from 'react';
import { gitSyncConnectionManager } from '../services/git-sync/GitSyncConnectionManager';

export interface GitSyncConnectionStatus {
  isConnected: boolean;
  connectionCount: number;
  isAuthenticated: boolean;
}

/**
 * Hook to track git-sync connection status
 */
export function useGitSyncConnection(
  repositoryPath?: string,
  branch?: string,
): GitSyncConnectionStatus {
  const [status, setStatus] = useState<GitSyncConnectionStatus>({
    isConnected: false,
    connectionCount: 0,
    isAuthenticated: false,
  });

  useEffect(() => {
    const updateStatus = async () => {
      try {
        const connectionsMap =
          await gitSyncConnectionManager.getActiveConnections();
        const authStatus = gitSyncConnectionManager.getAuthStatus();

        // Convert Map to array for easier processing
        const connections = Array.from(connectionsMap.values());

        // Check if we have a connection for this specific repo
        let isConnected = false;
        if (repositoryPath && branch) {
          isConnected = connections.some(
            (conn) => conn.repoPath === repositoryPath && conn.status.connected,
          );
        }

        const finalStatus = {
          isConnected:
            isConnected || connections.some((conn) => conn.status.connected),
          connectionCount: connections.length,
          isAuthenticated: authStatus.isAuthenticated,
        };

        setStatus(finalStatus);
      } catch (error) {
        console.error('[useGitSyncConnection] Failed to update status:', error);
      }
    };

    // Initial status
    updateStatus();

    // Listen for connection changes
    const handleConnectionAdded = () => updateStatus();
    const handleConnectionRemoved = () => updateStatus();
    const handleConnectionStatusChanged = () => updateStatus();
    const handleAuthChanged = () => updateStatus();

    gitSyncConnectionManager.on('connection-added', handleConnectionAdded);
    gitSyncConnectionManager.on('connection-removed', handleConnectionRemoved);
    gitSyncConnectionManager.on(
      'connection-status-changed',
      handleConnectionStatusChanged,
    );
    gitSyncConnectionManager.on('auth-changed', handleAuthChanged);

    return () => {
      gitSyncConnectionManager.removeListener(
        'connection-added',
        handleConnectionAdded,
      );
      gitSyncConnectionManager.removeListener(
        'connection-removed',
        handleConnectionRemoved,
      );
      gitSyncConnectionManager.removeListener(
        'connection-status-changed',
        handleConnectionStatusChanged,
      );
      gitSyncConnectionManager.removeListener(
        'auth-changed',
        handleAuthChanged,
      );
    };
  }, [repositoryPath, branch]);

  return status;
}
