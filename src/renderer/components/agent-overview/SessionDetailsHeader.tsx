import React, { useState } from 'react';
import { useTheme } from 'themed-markdown';
import { Package, Folder, GitBranch, FileSearch } from 'lucide-react';

interface Repository {
  root: string;
  rootDisplay?: string;
  fileCount: number;
  packages: Array<{
    path: string;
    pathDisplay?: string;
    name: string;
    version?: string;
    type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  }>;
  remotes?: Array<{
    name: string;
    url: string;
    owner?: string;
    repo?: string;
  }>;
  debug?: {
    originalPaths: string[];
    gitRoot: string;
    analysisTimestamp: number;
  };
}

interface SessionDetailsHeaderProps {
  sessionId: string;
  workingDirectory: string;
  basicGitInfo?: {
    gitRoot: string;
    relativePath: string;
    githubOwner?: string;
    githubRepo?: string;
    remoteUrl?: string;
  };
  repositories?: Repository[];
  // analysis removed - deprecated
  onDeleteSession?: () => void;
}

export const SessionDetailsHeader: React.FC<SessionDetailsHeaderProps> = ({
  sessionId,
  workingDirectory,
  basicGitInfo,
  repositories,
  onDeleteSession,
}) => {
  const { theme } = useTheme();
  // Analysis modal removed - deprecated feature

  // Get the repository info for display (prefer basicGitInfo, fall back to repositories)
  const hasGitInfo = basicGitInfo || (repositories && repositories.length > 0);

  // Determine repo name with multiple fallbacks
  let repoName = 'No Git Repository';
  let relativePath = '';

  if (basicGitInfo) {
    // Use new basicGitInfo (preferred)
    repoName =
      basicGitInfo.githubRepo ||
      basicGitInfo.gitRoot.split('/').pop() ||
      workingDirectory.split('/').pop() ||
      'Unknown';
    relativePath =
      basicGitInfo.relativePath !== '.' ? basicGitInfo.relativePath : '';
  } else if (repositories && repositories.length > 0) {
    // Fall back to old repositories array
    const primaryRepo = repositories[0];
    repoName =
      primaryRepo?.remotes?.[0]?.repo ||
      primaryRepo?.rootDisplay?.split('/').pop() ||
      primaryRepo?.root?.split('/').pop() ||
      workingDirectory.split('/').pop() ||
      'Unknown';
  } else {
    // No git info at all - use directory name
    repoName = workingDirectory.split('/').pop() || 'Unknown Directory';
  }

  return (
    <>
      <div
        style={{
          flexShrink: 0,
          padding: '12px 24px',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: `${theme.colors.backgroundSecondary}80`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ color: theme.colors.textSecondary }}>
                  {hasGitInfo ? <GitBranch size={18} /> : <Folder size={18} />}
                </span>
                {repoName}
                {relativePath && (
                  <span
                    style={{
                      fontSize: '14px',
                      color: theme.colors.textSecondary,
                      fontWeight: 400,
                    }}
                  >
                    / {relativePath}
                  </span>
                )}
              </h2>
              {/* Show working directory when no git info, or package badges when there is complex repo info */}
              {!hasGitInfo || !repositories || repositories.length === 0 ? (
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {workingDirectory}
                </div>
              ) : repositories &&
                repositories.length > 0 &&
                repositories.flatMap((repo) => repo.packages).length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px',
                  }}
                >
                  {repositories
                    .flatMap((repo) => repo.packages)
                    .slice(0, 4)
                    .map((pkg, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: theme.colors.backgroundHover,
                          color: theme.colors.textSecondary,
                        }}
                        title={`${pkg.name} v${pkg.version || '?'} (${pkg.type})`}
                      >
                        {pkg.name}
                      </span>
                    ))}
                  {repositories.reduce(
                    (sum, repo) => sum + repo.packages.length,
                    0,
                  ) > 4 && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: theme.colors.textTertiary,
                      }}
                    >
                      +
                      {repositories.reduce(
                        (sum, repo) => sum + repo.packages.length,
                        0,
                      ) - 4}{' '}
                      more
                    </span>
                  )}
                </div>
              ) : (
                // Repositories exist but no packages - show working directory
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {workingDirectory}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Analysis button removed - deprecated */}
            {/* Delete button */}
            {onDeleteSession && (
              <button
                onClick={onDeleteSession}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.error,
                  border: `1px solid ${theme.colors.error}`,
                  cursor: 'pointer',
                  fontSize: '12px',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.error;
                  e.currentTarget.style.color = theme.colors.background;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.error;
                }}
                title="Delete this session"
              >
                <svg
                  style={{ width: '14px', height: '14px' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Modal removed - deprecated */}
    </>
  );
};
