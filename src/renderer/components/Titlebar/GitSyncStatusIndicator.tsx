import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import { useGitSyncConnection } from '../../hooks/useGitSyncConnection';

export interface GitSyncStatusIndicatorProps {
  repositoryPath?: string;
  branch?: string;
}

/**
 * Displays the git-sync connection status in the titlebar
 */
export const GitSyncStatusIndicator: React.FC<GitSyncStatusIndicatorProps> = ({
  repositoryPath,
  branch,
}) => {
  const { theme } = useTheme();
  const { isConnected, connectionCount, isAuthenticated } =
    useGitSyncConnection(repositoryPath, branch);

  // Don't show indicator if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  const Icon = isConnected ? Wifi : WifiOff;
  const color = isConnected ? theme.colors.success : theme.colors.textSecondary;
  const title = isConnected
    ? `Git-Sync Connected (${connectionCount} ${connectionCount === 1 ? 'room' : 'rooms'})`
    : 'Git-Sync Disconnected';

  return (
    <div
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '4px',
        backgroundColor: isConnected
          ? `${theme.colors.success}15`
          : `${theme.colors.textSecondary}10`,
        cursor: 'default',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon
        size={14}
        color={color}
        style={{
          animation: isConnected ? 'none' : 'pulse 2s ease-in-out infinite',
        }}
      />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 500,
          color: color,
          userSelect: 'none',
        }}
      >
        Git-Sync
      </span>
      {isConnected && connectionCount > 0 && (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            color: color,
            backgroundColor: `${color}20`,
            padding: '2px 4px',
            borderRadius: '3px',
            minWidth: '16px',
            textAlign: 'center',
          }}
        >
          {connectionCount}
        </span>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
