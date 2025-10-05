import React, { useMemo } from 'react';
import { useTheme } from '@a24z/industry-theme';

interface MarkdownDocumentsPanelProps {
  markdownFiles: Array<{ path: string; lastModified?: string }>;
  isLoading: boolean;
  onMarkdownClick: (filePath: string) => void;
}

export const MarkdownDocumentsPanel: React.FC<MarkdownDocumentsPanelProps> = ({
  markdownFiles,
  isLoading,
  onMarkdownClick,
}) => {
  const { theme } = useTheme();

  const sortedMarkdownFiles = useMemo(() => {
    return [...markdownFiles].sort((a, b) => {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      return bTime - aTime;
    });
  }, [markdownFiles]);

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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: theme.fontSizes[2],
            fontWeight: 600,
            color: theme.colors.text,
          }}
        >
          Markdown Documents
        </h3>
        <span
          style={{
            fontSize: theme.fontSizes[1],
            color: theme.colors.textSecondary,
          }}
        >
          {sortedMarkdownFiles.length}
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            Loading markdown documents...
          </div>
        ) : sortedMarkdownFiles.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: theme.colors.textSecondary,
            }}
          >
            No markdown documents found
          </div>
        ) : (
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
