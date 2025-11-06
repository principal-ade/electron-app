import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { ThemedMonacoDiffEditor } from '@principal-ade/industry-themed-monaco-editor';
import { GitCommit, X } from 'lucide-react';

import type { GitChangeSelectionStatus } from '../../../shared/types/repository.types';
import { FileSystemService } from '../../main-process-api/FileSystemService';
import { GitService } from '../../main-process-api/GitService';

interface GitDiffPanelProps {
  relativeFilePath: string | null;
  repositoryPath: string | null;
  status?: GitChangeSelectionStatus;
  onClose?: () => void;
}

const statusMeta: Record<
  GitChangeSelectionStatus,
  { label: string; description: string }
> = {
  staged: {
    label: 'Staged change',
    description: 'Comparing staged changes against the last commit',
  },
  unstaged: {
    label: 'Unstaged change',
    description: 'Comparing working tree changes against the last commit',
  },
  untracked: {
    label: 'Untracked file',
    description: 'New file compared against an empty baseline',
  },
  deleted: {
    label: 'Deleted file',
    description: 'Showing the last committed contents of the deleted file',
  },
};

const languageFromPath = (relativeFilePath: string | null): string => {
  if (!relativeFilePath) {
    return 'plaintext';
  }

  const ext = relativeFilePath.split('.').pop()?.toLowerCase() ?? '';
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',
    cfg: 'ini',
    conf: 'ini',
    xml: 'xml',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    md: 'markdown',
    mdx: 'markdown',
    sql: 'sql',
  };

  return languageMap[ext] ?? 'plaintext';
};

const normalizeGitPath = (filePath: string): string => {
  return filePath.replace(/\\/g, '/');
};

export const GitDiffPanel: React.FC<GitDiffPanelProps> = ({
  relativeFilePath,
  repositoryPath,
  status,
  onClose,
}) => {
  const { theme } = useTheme();
  const [originalContent, setOriginalContent] = useState<string>('');
  const [modifiedContent, setModifiedContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const language = useMemo(() => languageFromPath(relativeFilePath), [relativeFilePath]);

  useEffect(() => {
    let isActive = true;

    const loadDiff = async () => {
      if (!relativeFilePath || !repositoryPath) {
        setOriginalContent('');
        setModifiedContent('');
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Join repository path with relative file path to get absolute path
        const absolutePath = `${repositoryPath}/${relativeFilePath}`.replace(/\/+/g, '/');

        let workingTreeContent = '';
        if (status !== 'deleted') {
          try {
            const fsResult = await FileSystemService.readFile(absolutePath);
            workingTreeContent = fsResult?.content ?? '';
          } catch (readError) {
            console.warn(
              'Failed to read working tree file for diff:',
              readError,
            );
            workingTreeContent = '';
          }
        }

        let baselineContent = '';
        if (status === 'untracked') {
          baselineContent = '';
        } else {
          try {
            const gitPath = normalizeGitPath(relativeFilePath);
            const showResult = await GitService.execCommand(repositoryPath, [
              'show',
              `HEAD:${gitPath}`,
            ]);
            baselineContent = showResult?.stdout ?? '';
          } catch (showError) {
            if (status === 'deleted') {
              throw showError;
            }
            console.warn('Falling back to empty baseline for diff:', showError);
            baselineContent = '';
          }
        }

        if (!isActive) {
          return;
        }

        setOriginalContent(baselineContent);
        setModifiedContent(status === 'deleted' ? '' : workingTreeContent);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error('Failed to load git diff:', err);
        setError(
          err instanceof Error
            ? `Failed to load diff: ${err.message}`
            : 'Failed to load diff',
        );
        setOriginalContent('');
        setModifiedContent('');
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadDiff();

    return () => {
      isActive = false;
    };
  }, [relativeFilePath, repositoryPath, status]);

  const statusInfo = status ? statusMeta[status] : null;
  const statusColor = useMemo(() => {
    if (!status) return theme.colors.textSecondary;

    switch (status) {
      case 'staged':
        return theme.colors.success || '#10b981';
      case 'unstaged':
        return theme.colors.warning || '#f59e0b';
      case 'untracked':
        return theme.colors.info || theme.colors.primary || '#3b82f6';
      case 'deleted':
        return theme.colors.error || '#ef4444';
      default:
        return theme.colors.textSecondary;
    }
  }, [status, theme.colors]);

  if (!relativeFilePath) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        Select a file from Git Changes to view its diff.
      </div>
    );
  }

  if (!repositoryPath) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          backgroundColor: theme.colors.backgroundSecondary,
          padding: '24px',
          textAlign: 'center',
        }}
      >
        Git diffs are only available for local repositories.
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: theme.colors.backgroundTertiary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.text,
              }}
            >
              <GitCommit size={18} />
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={relativeFilePath}
              >
                {relativeFilePath}
              </div>
              {statusInfo && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      backgroundColor: `${statusColor}20`,
                      color: statusColor,
                      border: `1px solid ${statusColor}60`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusInfo.label}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textSecondary,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {statusInfo.description}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: theme.colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {isLoading ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading diff...
          </div>
        ) : error ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.colors.error,
              padding: '20px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        ) : (
          <ThemedMonacoDiffEditor
            theme={theme}
            original={originalContent}
            modified={modifiedContent}
            language={language}
            height="100%"
            options={{
              renderSideBySide: true,
              readOnly: true,
              minimap: { enabled: false },
              automaticLayout: true,
              renderIndicators: true,
              diffAlgorithm: 'advanced',
              scrollbar: {
                useShadows: false,
                vertical: 'auto',
                horizontal: 'auto',
              },
            }}
            loadingComponent={
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: theme.colors.textSecondary,
                }}
              >
                Preparing diff editor...
              </div>
            }
          />
        )}
      </div>
    </div>
  );
};

export const GitDiffPanelPreview: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div
      style={{
        padding: '12px',
        fontSize: theme.fontSizes[0],
        color: theme.colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontFamily: theme.fonts.monospace,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
        }}
      >
        <span style={{ color: theme.colors.textSecondary }}>@@ 12,5 @@</span>
      </div>
      <div style={{ color: '#ef4444' }}>- const count = oldValue;</div>
      <div style={{ color: '#22c55e' }}>+ const count = newValue;</div>
      <div style={{ color: theme.colors.textSecondary }}> return count;</div>
    </div>
  );
};
