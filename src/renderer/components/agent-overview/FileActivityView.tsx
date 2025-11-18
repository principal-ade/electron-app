import React, { useState } from 'react';
import { useTheme } from '@principal-ade/industry-theme';
import { Check, Clipboard } from 'lucide-react';
import { FileActionButtons } from './SessionDetailCards';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';

interface FileActivityViewProps {
  session: AgentSessionRecord;
  FILE_SIZE_THRESHOLDS: {
    WARNING: number;
    LARGE: number;
  };
}

export const FileActivityView: React.FC<FileActivityViewProps> = ({
  session,
  FILE_SIZE_THRESHOLDS,
}) => {
  const { theme } = useTheme();
  const [fileFilter, setFileFilter] = useState<
    'all' | 'created' | 'updated' | 'deleted' | 'large'
  >('all');
  const [fileSortBy, setFileSortBy] = useState<'name' | 'size' | 'activity'>(
    'size',
  );
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Helper function to get relative path from git root
  const getRelativePath = (fullPath: string): string => {
    if (session.basicGitInfo?.gitRoot) {
      const { gitRoot } = session.basicGitInfo;
      if (fullPath.startsWith(gitRoot)) {
        // Remove git root and leading slash
        return fullPath.slice(gitRoot.length).replace(/^\//, '');
      }
    }
    // If no git info or path doesn't start with git root, return the full path
    return fullPath;
  };

  // Calculate file metrics
  const allFiles = [
    ...new Set([
      ...Object.keys(session.fileAccesses || {}),
      ...Object.keys(session.fileWrites || {}),
    ]),
  ];

  const createdFiles = allFiles.filter((file) => {
    const writes = session.fileWrites?.[file] || [];
    return writes.some((w) => w.operation === 'create');
  });

  const deletedFiles = allFiles.filter((file) => {
    const writes = session.fileWrites?.[file] || [];
    return writes.some((w) => w.operation === 'delete');
  });

  const largeFiles = allFiles.filter((file) => {
    const accesses = session.fileAccesses?.[file] || [];
    const writes = session.fileWrites?.[file] || [];
    const lastAccess = accesses[accesses.length - 1];
    const lastWrite = writes[writes.length - 1];

    const lineCount =
      lastWrite?.metadata?.lineCount || lastAccess?.metadata?.lineCount || 0;
    return lineCount >= FILE_SIZE_THRESHOLDS.WARNING;
  });

  // Apply filters
  const filteredFiles =
    fileFilter === 'all'
      ? allFiles
      : allFiles.filter((file) => {
          if (fileFilter === 'large') {
            const accesses = session.fileAccesses?.[file] || [];
            const writes = session.fileWrites?.[file] || [];
            const lastAccess = accesses[accesses.length - 1];
            const lastWrite = writes[writes.length - 1];

            const lineCount =
              lastWrite?.metadata?.lineCount ||
              lastAccess?.metadata?.lineCount ||
              0;
            return lineCount >= FILE_SIZE_THRESHOLDS.WARNING;
          }

          const writes = session.fileWrites?.[file] || [];

          if (fileFilter === 'created') {
            return writes.some((w) => w.operation === 'create');
          }
          if (fileFilter === 'updated') {
            return writes.some((w) => w.operation === 'update');
          }
          if (fileFilter === 'deleted') {
            return writes.some((w) => w.operation === 'delete');
          }
          return false;
        });

  // Apply search filter
  const searchedFiles = fileSearchQuery
    ? filteredFiles.filter((file) =>
        file.toLowerCase().includes(fileSearchQuery.toLowerCase()),
      )
    : filteredFiles;

  // Get file info for sorting
  const filesWithInfo = searchedFiles.map((file) => {
    const accesses = session.fileAccesses?.[file] || [];
    const writes = session.fileWrites?.[file] || [];
    const lastAccess = accesses[accesses.length - 1];
    const lastWrite = writes[writes.length - 1];
    const lastActivity = Math.max(
      lastAccess?.timestamp || 0,
      lastWrite?.timestamp || 0,
    );

    // Get line count from the most recent access or write
    let lineCount = 0;
    let fileSize = 0;

    // Check writes first (more likely to have updated info)
    if (lastWrite?.metadata?.lineCount) {
      lineCount = lastWrite.metadata.lineCount;
      fileSize = lastWrite.metadata.fileSize || 0;
    } else if (lastAccess?.metadata?.lineCount) {
      lineCount = lastAccess.metadata.lineCount;
      fileSize = lastAccess.metadata.fileSize || 0;
    }

    return {
      file,
      accesses,
      writes,
      lastActivity,
      lineCount,
      fileSize,
      totalActivity: accesses.length + writes.length,
    };
  });

  // Sort based on selected criteria
  if (fileSortBy === 'size') {
    filesWithInfo.sort((a, b) => b.lineCount - a.lineCount);
  } else if (fileSortBy === 'activity') {
    filesWithInfo.sort((a, b) => b.totalActivity - a.totalActivity);
  } else {
    filesWithInfo.sort((a, b) => a.file.localeCompare(b.file));
  }

  function FilePathDisplay({ filePath }: { filePath: string }) {
    const relativePath = getRelativePath(filePath);
    const fileName = relativePath.split('/').pop() || relativePath;
    const dirPath = relativePath.includes('/')
      ? relativePath.substring(0, relativePath.lastIndexOf('/'))
      : '';

    return (
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            fontFamily: theme.fonts.monospace,
            fontSize: '14px',
            fontWeight: 500,
            color: theme.colors.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
          title={fileName}
        >
          {fileName}
        </p>
        <p
          style={{
            fontFamily: theme.fonts.monospace,
            fontSize: '12px',
            color: theme.colors.textSecondary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
            marginTop: '2px',
          }}
          title={relativePath}
        >
          {dirPath ? `${dirPath}/` : ''}
          <span style={{ opacity: 0.5 }}>{fileName}</span>
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* File List */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          padding: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h3
              style={{ margin: 0, fontWeight: 500, color: theme.colors.text }}
            >
              {fileFilter === 'all'
                ? 'All Files'
                : fileFilter === 'created'
                  ? 'Created Files'
                  : fileFilter === 'updated'
                    ? 'Updated Files'
                    : fileFilter === 'deleted'
                      ? 'Deleted Files'
                      : 'Large Files'}
            </h3>
            {fileFilter !== 'all' && (
              <button
                onClick={() => setFileFilter('all')}
                style={{
                  fontSize: '12px',
                  color: theme.colors.primary,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = theme.colors.accent)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = theme.colors.primary)
                }
              >
                ← Show all
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontSize: '12px', color: theme.colors.textSecondary }}
              >
                Filter:
              </span>
              <select
                value={fileFilter}
                onChange={(e) => setFileFilter(e.target.value as any)}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`)
                }
                onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <option value="all">All</option>
                <option value="created">Created</option>
                <option value="updated">Updated</option>
                <option value="deleted">Deleted</option>
                <option value="large">{`Large (${FILE_SIZE_THRESHOLDS.WARNING}+ lines)`}</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{ fontSize: '12px', color: theme.colors.textSecondary }}
              >
                Sort:
              </span>
              <select
                value={fileSortBy}
                onChange={(e) => setFileSortBy(e.target.value as any)}
                style={{
                  fontSize: '12px',
                  padding: '4px 8px',
                  backgroundColor: theme.colors.backgroundTertiary,
                  color: theme.colors.text,
                  borderRadius: '4px',
                  border: `1px solid ${theme.colors.border}`,
                  cursor: 'pointer',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`)
                }
                onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <option value="name">Name</option>
                <option value="size">Size</option>
                <option value="activity">Activity</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search input */}
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Search files..."
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 12px',
              backgroundColor: theme.colors.backgroundTertiary,
              color: theme.colors.text,
              fontSize: '14px',
              borderRadius: '4px',
              border: `1px solid ${theme.colors.border}`,
              outline: 'none',
            }}
            onFocus={(e) =>
              (e.currentTarget.style.boxShadow = `0 0 0 2px ${theme.colors.primary}33`)
            }
            onBlur={(e) => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filesWithInfo.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '16px 0',
                color: theme.colors.textSecondary,
              }}
            >
              <p style={{ margin: 0 }}>No files match the current filter</p>
            </div>
          ) : (
            <>
              {/* Count display */}
              <div
                style={{
                  marginBottom: '12px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                Showing {filesWithInfo.length} of {allFiles.length} files
                {fileFilter !== 'all' && (
                  <span
                    style={{
                      marginLeft: '8px',
                      padding: '2px 8px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderRadius: '4px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {fileFilter} filter active
                  </span>
                )}
                {fileSearchQuery && (
                  <span
                    style={{
                      marginLeft: '8px',
                      padding: '2px 8px',
                      backgroundColor: theme.colors.backgroundTertiary,
                      borderRadius: '4px',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    "{fileSearchQuery}" search active
                  </span>
                )}
              </div>

              {filesWithInfo.map(
                ({
                  file,
                  accesses,
                  writes,
                  lastActivity,
                  lineCount,
                  fileSize,
                }) => {
                  const isLargeFile = lineCount >= FILE_SIZE_THRESHOLDS.LARGE;
                  const isWarningFile =
                    lineCount >= FILE_SIZE_THRESHOLDS.WARNING &&
                    lineCount < FILE_SIZE_THRESHOLDS.LARGE;

                  return (
                    <div
                      key={file}
                      style={{
                        backgroundColor: theme.colors.backgroundTertiary,
                        borderRadius: '4px',
                        padding: '12px',
                        boxShadow: isLargeFile
                          ? `0 0 0 1px ${theme.colors.warning}80`
                          : isWarningFile
                            ? `0 0 0 1px ${theme.colors.warning}50`
                            : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                        }}
                      >
                        <FilePathDisplay filePath={file} />
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <button
                            onClick={() => {
                              const relativePath = getRelativePath(file);
                              navigator.clipboard.writeText(relativePath);
                              setCopiedPath(file);
                              setTimeout(() => setCopiedPath(null), 2000);
                            }}
                            style={{
                              opacity: 0.6,
                              transition: 'opacity 0.2s',
                              fontSize: '12px',
                              padding: '4px',
                              backgroundColor: 'transparent',
                              color: theme.colors.textSecondary,
                              borderRadius: '4px',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1';
                              e.currentTarget.style.backgroundColor =
                                theme.colors.backgroundHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.6';
                              e.currentTarget.style.backgroundColor =
                                'transparent';
                            }}
                            title={
                              session.basicGitInfo
                                ? 'Copy relative path'
                                : 'Copy filename'
                            }
                          >
                            {copiedPath === file ? (
                              <Check size={14} />
                            ) : (
                              <Clipboard size={14} />
                            )}
                          </button>
                          {lineCount > 0 && (
                            <span
                              style={{
                                fontSize: '12px',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                flexShrink: 0,
                                backgroundColor: isLargeFile
                                  ? `${theme.colors.warning}20`
                                  : isWarningFile
                                    ? `${theme.colors.warning}20`
                                    : theme.colors.backgroundHover,
                                color: isLargeFile
                                  ? theme.colors.warning
                                  : isWarningFile
                                    ? theme.colors.warning
                                    : theme.colors.textSecondary,
                              }}
                            >
                              {lineCount.toLocaleString()} lines
                            </span>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          marginTop: '8px',
                          fontSize: '12px',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        {accesses.length > 0 && (
                          <span>
                            {accesses.length} read
                            {accesses.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {writes.length > 0 && (
                          <span>
                            {writes.length} write
                            {writes.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span>
                          Last: {new Date(lastActivity).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  );
                },
              )}
            </>
          )}

          {Object.keys(session.fileAccesses || {}).length === 0 &&
            Object.keys(session.fileWrites || {}).length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '16px 0',
                  color: theme.colors.textSecondary,
                }}
              >
                <p style={{ margin: 0 }}>No file activity recorded</p>
              </div>
            )}
        </div>
      </div>

      {/* Toast notification */}
      {copiedPath && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            right: '16px',
            zIndex: 50,
            animation: 'slideInTop 0.3s ease-out',
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.success,
              color: theme.colors.background,
              padding: '8px 16px',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Check size={14} /> Copied to clipboard
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
