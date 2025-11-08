import React, { useState } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { FileText, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import type { AlexandriaDocItemData } from './AlexandriaDocsPanel';
import type { GitStatus } from '../../../shared/types/repository.types';
import { CodebaseViewFileTree } from './CodebaseViewFileTree';

interface AlexandriaDocItemProps {
  doc: AlexandriaDocItemData;
  isSelected: boolean;
  onSelect: (filePath: string, type: 'markdown' | 'excalidraw') => void;
  formatRelativeTime: (date: Date) => string;
  trackedFiles?: string[];
  onFileSelect?: (filePath: string) => void;
  gitStatus?: GitStatus;
  hasChangedFiles?: boolean;
}

export const AlexandriaDocItem: React.FC<AlexandriaDocItemProps> = ({
  doc,
  isSelected,
  onSelect,
  formatRelativeTime,
  trackedFiles,
  onFileSelect,
  gitStatus,
  hasChangedFiles = false,
}) => {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);

  const canExpand = doc.isTracked && trackedFiles && trackedFiles.length > 0;

  const handleTrackedClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canExpand) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div>
      <div
        onClick={() => onSelect(doc.path, 'markdown')}
        style={{
          padding: '16px 20px',
          backgroundColor: isSelected
            ? `${theme.colors.primary}15`
            : 'transparent',
          borderLeft: isSelected ? `3px solid ${theme.colors.primary}` : 'none',
          borderBottom: `1px solid ${theme.colors.border}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: theme.fonts.body,
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor =
              theme.colors.backgroundTertiary;
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <FileText
              size={20}
              color={
                isSelected ? theme.colors.primary : theme.colors.textSecondary
              }
            />
            {/* Tracked/Untracked indicator */}
            <div
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: doc.isTracked
                  ? theme.colors.success
                  : theme.colors.warning,
                border: `1px solid ${theme.colors.background}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title={
                doc.isTracked ? 'Tracked (in CodebaseView)' : 'Untracked'
              }
            >
              {doc.isTracked ? (
                <Eye size={6} color={theme.colors.backgroundLight} />
              ) : (
                <EyeOff size={6} color={theme.colors.backgroundLight} />
              )}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '2px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[2],
                  fontWeight: isSelected
                    ? theme.fontWeights.semibold
                    : theme.fontWeights.medium,
                  color: isSelected ? theme.colors.primary : theme.colors.text,
                }}
              >
                {doc.name}
              </div>
              {doc.mtime && (
                <div
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: theme.colors.textSecondary,
                    opacity: 0.7,
                    flexShrink: 0,
                    fontWeight: theme.fontWeights.medium,
                  }}
                  title={doc.mtime.toLocaleString()}
                >
                  {formatRelativeTime(doc.mtime)}
                </div>
              )}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                style={{
                  fontSize: theme.fontSizes[1],
                  color: theme.colors.textSecondary,
                  opacity: 0.8,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}
              >
                {doc.relativePath}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <div
                  onClick={handleTrackedClick}
                  style={{
                    fontSize: theme.fontSizes[1],
                    color: doc.isTracked
                      ? theme.colors.success
                      : theme.colors.warning,
                    fontWeight: theme.fontWeights.medium,
                    flexShrink: 0,
                    cursor: canExpand ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: canExpand ? '2px 6px' : '0',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (canExpand) {
                      e.currentTarget.style.backgroundColor =
                        doc.isTracked
                          ? `${theme.colors.success}20`
                          : `${theme.colors.warning}20`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (canExpand) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {canExpand && (
                    <>
                      {isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )}
                    </>
                  )}
                  <span>{doc.isTracked ? 'tracked' : 'untracked'}</span>
                </div>
                {hasChangedFiles && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: '#f59e0b',
                      flexShrink: 0,
                    }}
                    title="Associated files have uncommitted changes"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {isExpanded && trackedFiles && (
        <div
          style={{
            backgroundColor: theme.colors.backgroundSecondary,
            borderBottom: `1px solid ${theme.colors.border}`,
            borderLeft: isSelected ? `3px solid ${theme.colors.primary}` : 'none',
          }}
        >
          <div
            style={{
              padding: '8px 20px 8px 52px',
              fontSize: theme.fontSizes[0],
              color: theme.colors.textSecondary,
              fontWeight: theme.fontWeights.medium,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            {trackedFiles.length} file{trackedFiles.length !== 1 ? 's' : ''} in
            CodebaseView
          </div>
          <div
            style={{
              maxHeight: '400px',
              overflow: 'auto',
              backgroundColor: theme.colors.background,
            }}
          >
            <CodebaseViewFileTree
              files={trackedFiles}
              gitStatus={gitStatus}
              defaultOpen={true}
              onFileSelect={onFileSelect}
              padding="8px 12px"
              autoHeight={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
