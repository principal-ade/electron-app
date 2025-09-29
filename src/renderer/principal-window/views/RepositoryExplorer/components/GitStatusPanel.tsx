import React from 'react';
import { GitBranch } from 'lucide-react';
import { useTheme } from 'themed-markdown';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../shared/types/repository.types';

interface GitStatusPanelProps {
  repository: EnhancedAlexandriaEntry;
  gitStatus: GitStatus;
  isLoadingGitStatus: boolean;
  onFileClick: (filePath: string) => void;
}

export const GitStatusPanel: React.FC<GitStatusPanelProps> = ({
  repository,
  gitStatus,
  isLoadingGitStatus,
  onFileClick,
}) => {
  const { theme } = useTheme();

  // Format relative time
  const getRelativeTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 30) return `${Math.floor(days / 30)} months ago`;
    if (days > 0) return `${days} days ago`;
    if (hours > 0) return `${hours} hours ago`;
    if (minutes > 0) return `${minutes} minutes ago`;
    return 'Just now';
  };

  const hasChanges = gitStatus.staged.length > 0 || gitStatus.unstaged.length > 0 || gitStatus.untracked.length > 0 || gitStatus.deleted.length > 0;

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        height: 'fit-content',
      }}
    >
      {/* Show Git Changes if there are any */}
      {hasChanges ? (
        <>
          <div
            style={{
              fontSize: theme.fontSizes[1],
              color: theme.colors.textSecondary,
              marginBottom: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitBranch size={14} />
              Git Changes
            </span>
            {isLoadingGitStatus && (
              <span style={{ fontSize: theme.fontSizes[0], fontWeight: 'normal', marginRight: '4px' }}>
                Loading...
              </span>
            )}
          </div>
          <div
            style={{
              maxHeight: '300px',
              overflow: 'auto',
            }}
          >
            {isLoadingGitStatus ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: theme.colors.textSecondary,
                  fontSize: theme.fontSizes[1],
                }}
              >
                Loading git status...
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Staged Files */}
                {gitStatus.staged.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      STAGED ({gitStatus.staged.length})
                    </div>
                    {gitStatus.staged.map((file) => {
                      const filename = file.path.split('/').pop() || file.path;
                      const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                      return (
                        <div
                          key={`staged-${file.path}`}
                          style={{
                            padding: '10px',
                            backgroundColor: `${theme.colors.success}10`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.success}20`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.success}10`;
                          }}
                          onClick={() => onFileClick(file.path)}
                          title={file.path}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '2px',
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.success,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 auto',
                                minWidth: 0,
                              }}
                            >
                              ✓ {filename}
                            </div>
                            {file.lastModified && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.success,
                                  opacity: 0.7,
                                  whiteSpace: 'nowrap',
                                  marginLeft: '8px',
                                  flex: '0 0 auto',
                                }}
                              >
                                {getRelativeTime(file.lastModified)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.success,
                              opacity: 0.6,
                              fontFamily: theme.fonts.monospace,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            {directory === 'root' ? 'root' : `${directory}/`}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Unstaged Files */}
                {gitStatus.unstaged.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      MODIFIED ({gitStatus.unstaged.length})
                    </div>
                    {gitStatus.unstaged.map((file) => {
                      const filename = file.path.split('/').pop() || file.path;
                      const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                      return (
                        <div
                          key={`unstaged-${file.path}`}
                          style={{
                            padding: '10px',
                            backgroundColor: `${theme.colors.warning}10`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.warning}20`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.warning}10`;
                          }}
                          onClick={() => onFileClick(file.path)}
                          title={file.path}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '2px',
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.warning,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 auto',
                                minWidth: 0,
                              }}
                            >
                              ✎ {filename}
                            </div>
                            {file.lastModified && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.warning,
                                  opacity: 0.7,
                                  whiteSpace: 'nowrap',
                                  marginLeft: '8px',
                                  flex: '0 0 auto',
                                }}
                              >
                                {getRelativeTime(file.lastModified)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.warning,
                              opacity: 0.6,
                              fontFamily: theme.fonts.monospace,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            {directory === 'root' ? 'root' : `${directory}/`}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Deleted Files */}
                {gitStatus.deleted.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      DELETED ({gitStatus.deleted.length})
                    </div>
                    {gitStatus.deleted.map((file) => {
                      const filename = file.path.split('/').pop() || file.path;
                      const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                      return (
                        <div
                          key={`deleted-${file.path}`}
                          style={{
                            padding: '10px',
                            backgroundColor: `${theme.colors.error}10`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.error}20`;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              `${theme.colors.error}10`;
                          }}
                          onClick={() => onFileClick(file.path)}
                          title={file.path}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '2px',
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.error,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 auto',
                                minWidth: 0,
                              }}
                            >
                              ✕ {filename}
                            </div>
                            {file.lastModified && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  color: theme.colors.error,
                                  opacity: 0.7,
                                  whiteSpace: 'nowrap',
                                  marginLeft: '8px',
                                  flex: '0 0 auto',
                                }}
                              >
                                {getRelativeTime(file.lastModified)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              color: theme.colors.error,
                              opacity: 0.6,
                              fontFamily: theme.fonts.monospace,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            {directory === 'root' ? 'root' : `${directory}/`}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Untracked Files */}
                {gitStatus.untracked.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: theme.fontSizes[0],
                        color: theme.colors.textSecondary,
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      UNTRACKED ({gitStatus.untracked.length})
                    </div>
                    {gitStatus.untracked.map((file) => {
                      const filename = file.path.split('/').pop() || file.path;
                      const directory = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : 'root';

                      return (
                        <div
                          key={`untracked-${file.path}`}
                          style={{
                            padding: '10px',
                            backgroundColor: theme.colors.background,
                            border: `1px dashed ${theme.colors.border}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor =
                              theme.colors.backgroundTertiary;
                            e.currentTarget.style.color = theme.colors.text;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor =
                              theme.colors.background;
                            e.currentTarget.style.color = theme.colors.textSecondary;
                          }}
                          onClick={() => onFileClick(file.path)}
                          title={file.path}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '2px',
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize: theme.fontSizes[1],
                                color: 'inherit',
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: '1 1 auto',
                                minWidth: 0,
                              }}
                            >
                              ? {filename}
                            </div>
                            {file.lastModified && (
                              <div
                                style={{
                                  fontSize: theme.fontSizes[0],
                                  opacity: 0.7,
                                  whiteSpace: 'nowrap',
                                  marginLeft: '8px',
                                  flex: '0 0 auto',
                                }}
                              >
                                {getRelativeTime(file.lastModified)}
                              </div>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: theme.fontSizes[0],
                              opacity: 0.6,
                              fontFamily: theme.fonts.monospace,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              width: '100%',
                            }}
                          >
                            {directory === 'root' ? 'root' : `${directory}/`}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Show Last Commit when there are no changes */
        repository.lastCommitMessage ? (() => {
          const commitMessage = repository.lastCommitMessage;
          const lines = commitMessage.split('\n');
          const firstLine = lines[0];
          const hasMoreContent = lines.length > 1 && lines.slice(1).some((line: string) => line.trim());

          return (
            <>
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  marginBottom: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GitBranch size={14} />
                  Last Commit
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: theme.fontSizes[2],
                        color: theme.colors.text,
                        fontWeight: 500,
                        flex: 1,
                        lineHeight: '1.4',
                      }}
                    >
                      {firstLine}
                    </div>
                  </div>

                  {/* Full Commit Message */}
                  {hasMoreContent && (
                    <div
                      style={{
                        padding: '8px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        borderRadius: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {lines.slice(1).join('\n').trim()}
                      </div>
                    </div>
                  )}

                  {/* Commit Metadata */}
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {repository.lastCommitAuthor && (
                      <span>{repository.lastCommitAuthor}</span>
                    )}
                    {repository.lastCommitAuthor && repository.lastCommitHash && (
                      <span>•</span>
                    )}
                    {repository.lastCommitHash && (
                      <span style={{ fontFamily: theme.fonts.monospace, fontSize: '9px' }}>
                        {repository.lastCommitHash.substring(0, 8)}
                      </span>
                    )}
                    {(repository.lastCommitAuthor || repository.lastCommitHash) && (
                      <span>•</span>
                    )}
                    <span>{getRelativeTime(repository.github?.lastCommit)}</span>
                  </div>
                </div>
              </div>
            </>
          );
        })() : (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes[1],
            }}
          >
            No changes - working tree clean
          </div>
        )
      )}
    </div>
  );
};