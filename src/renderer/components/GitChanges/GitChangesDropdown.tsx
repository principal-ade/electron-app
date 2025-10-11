import React, { useEffect, useRef } from 'react';
import { FileText, FilePlus, FileX, FileEdit, GitBranch } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { GitStatusWithFiles } from '../../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';

export interface GitChangesDropdownProps {
  gitStatusWithFiles: GitStatusWithFiles;
  onFileClick: (filePath: string) => void;
  onClose: () => void;
  anchorElement: HTMLElement | null;
}

interface FileGroup {
  title: string;
  files: string[];
  icon: React.ReactNode;
  color: string;
}

export const GitChangesDropdown: React.FC<GitChangesDropdownProps> = ({
  gitStatusWithFiles,
  onFileClick,
  onClose,
  anchorElement,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { theme, colorMode } = useTheme();

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (dropdownRef.current && anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      const dropdown = dropdownRef.current;

      dropdown.style.top = `${rect.bottom + 8}px`;

      const dropdownRect = dropdown.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      if (dropdownRect.right > viewportWidth - 20) {
        dropdown.style.right = '20px';
        dropdown.style.left = 'auto';
      } else {
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.right = 'auto';
      }
    }
  }, [anchorElement]);

  const fileGroups: FileGroup[] = [
    {
      title: 'Staged',
      files: gitStatusWithFiles.stagedFiles,
      icon: <GitBranch size={14} />,
      color: theme.colors.success || '#10b981',
    },
    {
      title: 'Modified',
      files: gitStatusWithFiles.modifiedFiles,
      icon: <FileEdit size={14} />,
      color: theme.colors.warning || '#f59e0b',
    },
    {
      title: 'Created',
      files: gitStatusWithFiles.createdFiles,
      icon: <FilePlus size={14} />,
      color: theme.colors.info || '#3b82f6',
    },
    {
      title: 'Deleted',
      files: gitStatusWithFiles.deletedFiles,
      icon: <FileX size={14} />,
      color: theme.colors.error || '#ef4444',
    },
    {
      title: 'Untracked',
      files: gitStatusWithFiles.untrackedFiles,
      icon: <FileText size={14} />,
      color: colorMode === 'dark' ? '#9ca3af' : '#6b7280',
    },
  ].filter((group) => group.files.length > 0);

  const backgroundColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.backgroundSecondary || '#1e1e1e'
      : theme.colors.backgroundSecondary || '#ffffff';

  const borderColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.border || '#333333'
      : theme.colors.border || '#e5e7eb';

  const textColor =
    colorMode === 'dark'
      ? theme.colors.modes?.dark?.text || '#d1d5db'
      : theme.colors.text || '#1f2937';

  const hoverColor =
    colorMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div
      ref={dropdownRef}
      className="git-changes-dropdown"
      style={{
        position: 'fixed',
        zIndex: 1000,
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: '8px',
        boxShadow:
          colorMode === 'dark'
            ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
            : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        minWidth: '280px',
        maxWidth: '400px',
        maxHeight: '400px',
        overflowY: 'auto',
        padding: '8px',
        fontFamily: theme.fonts.body,
        fontSize: '13px',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${borderColor}`,
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: textColor,
          fontWeight: 600,
        }}
      >
        <GitBranch size={16} />
        <span>Uncommitted Changes</span>
        <span style={{ marginLeft: 'auto', opacity: 0.7, fontWeight: 400 }}>
          {fileGroups.reduce((acc, group) => acc + group.files.length, 0)} files
        </span>
      </div>

      {fileGroups.map((group, groupIndex) => (
        <div
          key={group.title}
          style={{
            marginBottom: groupIndex < fileGroups.length - 1 ? '12px' : '0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              color: group.color,
              fontSize: '12px',
              fontWeight: 600,
              opacity: 0.9,
            }}
          >
            {group.icon}
            <span>{group.title}</span>
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
              {group.files.length}
            </span>
          </div>

          {group.files.map((file) => {
            const isMarkdown = file.endsWith('.md');
            const fileName = file.split('/').pop() || file;
            const filePath = file.includes('/')
              ? file.substring(0, file.lastIndexOf('/'))
              : '';

            return (
              <div
                key={file}
                onClick={() => onFileClick(file)}
                style={{
                  padding: '6px 12px 6px 32px',
                  cursor: isMarkdown ? 'pointer' : 'default',
                  color: textColor,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderRadius: '4px',
                  transition: 'background-color 0.15s ease',
                  opacity: isMarkdown ? 1 : 0.7,
                }}
                onMouseEnter={(e) => {
                  if (isMarkdown) {
                    e.currentTarget.style.backgroundColor = hoverColor;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={isMarkdown ? `Click to view ${file}` : file}
              >
                <FileText size={12} style={{ opacity: 0.6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: isMarkdown ? 500 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fileName}
                  </div>
                  {filePath && (
                    <div
                      style={{
                        fontSize: '11px',
                        opacity: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {filePath}
                    </div>
                  )}
                </div>
                {isMarkdown && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: group.color + '20',
                      color: group.color,
                      fontWeight: 600,
                    }}
                  >
                    MD
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {fileGroups.length === 0 && (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            color: textColor,
            opacity: 0.6,
          }}
        >
          No changes detected
        </div>
      )}
    </div>
  );
};
