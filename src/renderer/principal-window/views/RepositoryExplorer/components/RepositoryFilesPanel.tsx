import React, { useMemo, useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { GitStatusFileTree, type GitFileStatus } from '@a24z/dynamic-file-tree';
import { PathsFileTreeBuilder, type FileTree } from '@principal-ai/repository-abstraction';
import type { EnhancedAlexandriaEntry, GitStatus } from '../../../../../shared/types/repository.types';

interface RepositoryFilesPanelProps {
  repository: EnhancedAlexandriaEntry;
  gitStatus: GitStatus;
  markdownFiles: Array<{ path: string; lastModified?: string }>;
  isLoadingGitStatus: boolean;
  isLoadingDocs: boolean;
  onFileClick: (filePath: string) => void;
  onMarkdownClick: (filePath: string) => void;
}

type TabType = 'changes' | 'docs';

export const RepositoryFilesPanel: React.FC<RepositoryFilesPanelProps> = ({
  repository,
  gitStatus,
  markdownFiles,
  isLoadingGitStatus,
  isLoadingDocs,
  onFileClick,
  onMarkdownClick,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('docs');

  // Check if there are git changes
  const hasChanges =
    gitStatus.staged.length > 0 ||
    gitStatus.unstaged.length > 0 ||
    gitStatus.untracked.length > 0 ||
    gitStatus.deleted.length > 0;

  // Build git changes tree and status data
  const gitChangesData = useMemo<{ tree: FileTree; statusData: GitFileStatus[] } | null>(() => {
    if (!hasChanges || isLoadingGitStatus) return null;

    const allChangedFiles = [
      ...gitStatus.staged.map(f => f.path),
      ...gitStatus.unstaged.map(f => f.path),
      ...gitStatus.untracked.map(f => f.path),
      ...gitStatus.deleted.map(f => f.path),
    ].sort((a, b) => a.localeCompare(b)); // Sort alphabetically

    const builder = new PathsFileTreeBuilder();
    const tree = builder.build({
      files: allChangedFiles,
      rootPath: repository.path,
    });

    // Build git status data for coloring
    const statusData: GitFileStatus[] = [
      ...gitStatus.staged.map(f => ({
        filePath: f.path,
        indexStatus: 'A',
        workingTreeStatus: ' ',
        status: 'A' as const,
      })),
      ...gitStatus.unstaged.map(f => ({
        filePath: f.path,
        indexStatus: ' ',
        workingTreeStatus: 'M',
        status: 'M' as const,
      })),
      ...gitStatus.deleted.map(f => ({
        filePath: f.path,
        indexStatus: ' ',
        workingTreeStatus: 'D',
        status: 'D' as const,
      })),
      ...gitStatus.untracked.map(f => ({
        filePath: f.path,
        indexStatus: '?',
        workingTreeStatus: '?',
        status: '??' as const,
      })),
    ];

    return { tree, statusData };
  }, [gitStatus, repository.path, hasChanges, isLoadingGitStatus]);

  // Sort markdown files by last modified
  const sortedMarkdownFiles = useMemo(() => {
    return [...markdownFiles].sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    });
  }, [markdownFiles]);

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

  // Determine which tab to show based on available data
  const showChangesTab = hasChanges && !isLoadingGitStatus;
  const showDocsTab = markdownFiles.length > 0 && !isLoadingDocs;

  // Auto-switch tabs if the current tab becomes unavailable
  React.useEffect(() => {
    if (!showDocsTab && showChangesTab && activeTab === 'docs') {
      setActiveTab('changes');
    } else if (!showChangesTab && showDocsTab && activeTab === 'changes') {
      setActiveTab('docs');
    }
  }, [showChangesTab, showDocsTab, activeTab]);

  // Show loading state
  if (isLoadingGitStatus || isLoadingDocs) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
          }}
        >
          Loading repository files...
        </div>
      </div>
    );
  }

  // Show empty state when no data
  if (!showChangesTab && !showDocsTab) {
    return (
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderRadius: '8px',
          border: `1px solid ${theme.colors.border}`,
        }}
      >
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes[1],
          }}
        >
          No changes or documents to display
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px',
        border: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '600px',
      }}
    >
      {/* Header with tabs */}
      <div
        style={{
          display: 'flex',
          marginBottom: '12px',
          borderBottom: `1px solid ${theme.colors.border}`,
        }}
      >
        {showDocsTab && (
          <button
            onClick={() => setActiveTab('docs')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: activeTab === 'docs' ? theme.colors.background : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'docs' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              color: activeTab === 'docs' ? theme.colors.text : theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: activeTab === 'docs' ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            Markdown Documents ({sortedMarkdownFiles.length})
          </button>
        )}
        {showChangesTab && (
          <button
            onClick={() => setActiveTab('changes')}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: activeTab === 'changes' ? theme.colors.background : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'changes' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
              color: activeTab === 'changes' ? theme.colors.text : theme.colors.textSecondary,
              cursor: 'pointer',
              fontSize: theme.fontSizes[1],
              fontWeight: activeTab === 'changes' ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            Git Changes
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'changes' && gitChangesData && (
          <GitStatusFileTree
            fileTree={gitChangesData.tree}
            theme={theme}
            gitStatusData={gitChangesData.statusData}
            onFileSelect={onFileClick}
            showIcons={true}
          />
        )}

        {activeTab === 'docs' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {sortedMarkdownFiles.map((file) => {
              const filename = file.path.split('/').pop() || file.path;
              const directory = file.path.includes('/')
                ? file.path.substring(0, file.path.lastIndexOf('/'))
                : 'root';

              return (
                <div
                  key={file.path}
                  style={{
                    padding: '10px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.background;
                  }}
                  onClick={() => onMarkdownClick(file.path)}
                  title={file.path}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '2px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.text,
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {filename}
                    </div>
                    {file.lastModified && (
                      <div
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          whiteSpace: 'nowrap',
                          marginLeft: '8px',
                        }}
                      >
                        {getRelativeTime(file.lastModified)}
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: theme.fontSizes[0],
                      color: theme.colors.textSecondary,
                      fontFamily: theme.fonts.monospace,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {directory === 'root' ? 'root' : `${directory}/`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
