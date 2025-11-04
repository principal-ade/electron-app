import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@a24z/industry-theme';
import {
  FileText,
  Terminal as TerminalIcon,
  BookOpen,
  GitCommit,
} from 'lucide-react';
import { FilePreviewPanel } from '../../../../panels/components/FilePreviewPanel';
import { MarkdownRenderingPanel } from '../../../../panels/components/MarkdownRenderingPanel';
import TerminalPanel from '../../../../panels/TerminalPanelPackaged';
import { createFileTreeSource } from '../../../../types/file-tree-source';
import { GitDiffPanel } from '../../../../panels/components/GitDiffPanel';
import type { GitChangeSelectionStatus } from '../../../../../shared/types/repository.types';

interface RightPanelProps {
  filePath: string | null;
  repositoryPath: string;
  activeTab?: 'preview' | 'terminal' | 'markdown' | 'diff';
  selectionMode?: 'preview' | 'diff';
  gitStatus?: GitChangeSelectionStatus;
  onTabChange?: (tab: 'preview' | 'terminal' | 'markdown' | 'diff') => void;
  onClose?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  filePath,
  repositoryPath,
  activeTab: externalActiveTab,
  selectionMode = 'preview',
  gitStatus,
  onTabChange,
  onClose,
}) => {
  const { theme } = useTheme();
  const [internalActiveTab, setInternalActiveTab] = useState<
    'preview' | 'terminal' | 'markdown' | 'diff'
  >('preview');

  // Use external tab if provided, otherwise use internal state
  const activeTab =
    externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;

  // Create a FileTreeSource for the local repository
  const source = useMemo(() => {
    if (!repositoryPath) return null;
    const repoName = repositoryPath.split('/').pop() || 'repository';
    return createFileTreeSource.localWorkingCopy(
      repositoryPath,
      '', // owner unknown in this context
      repoName,
      '', // remoteUrl unknown in this context
    );
  }, [repositoryPath]);

  const handleTabChange = useCallback(
    (tab: 'preview' | 'terminal' | 'markdown' | 'diff') => {
      if (onTabChange) {
        onTabChange(tab);
      } else {
        setInternalActiveTab(tab);
      }
    },
    [onTabChange],
  );

  // Switch tabs when selection mode changes
  useEffect(() => {
    if (!filePath) {
      if (activeTab === 'diff') {
        handleTabChange('preview');
      }
      return;
    }

    if (selectionMode === 'diff') {
      if (activeTab !== 'diff') {
        handleTabChange('diff');
      }
    } else if (activeTab === 'diff') {
      handleTabChange('preview');
    }
  }, [filePath, selectionMode, activeTab, handleTabChange]);

  // Switch to appropriate tab when a file is selected (non-diff modes)
  useEffect(() => {
    if (filePath && selectionMode !== 'diff') {
      // Check if it's a markdown file
      const isMarkdown = filePath.toLowerCase().endsWith('.md');
      if (isMarkdown && activeTab === 'terminal') {
        handleTabChange('markdown');
      } else if (!isMarkdown && activeTab === 'terminal') {
        handleTabChange('preview');
      }
    }
  }, [filePath, selectionMode, activeTab, handleTabChange]);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
      }}
    >
      {/* Tab Header */}
      <div
        style={{
          display: 'flex',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundSecondary,
        }}
      >
        <button
          onClick={() => handleTabChange('preview')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor:
              activeTab === 'preview' ? theme.colors.background : 'transparent',
            color:
              activeTab === 'preview'
                ? theme.colors.text
                : theme.colors.textSecondary,
            border: 'none',
            borderBottom:
              activeTab === 'preview'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'preview' ? 600 : 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'preview') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'preview') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <FileText size={16} />
          File Preview
        </button>
        <button
          onClick={() => handleTabChange('diff')}
          disabled={selectionMode !== 'diff'}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor:
              activeTab === 'diff' ? theme.colors.background : 'transparent',
            color:
              activeTab === 'diff'
                ? theme.colors.text
                : theme.colors.textSecondary,
            border: 'none',
            borderBottom:
              activeTab === 'diff'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
            cursor: selectionMode !== 'diff' ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'diff' ? 600 : 500,
            transition: 'all 0.2s',
            opacity: selectionMode !== 'diff' ? 0.6 : 1,
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'diff' && selectionMode === 'diff') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'diff') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <GitCommit size={16} />
          Diff
        </button>
        <button
          onClick={() => handleTabChange('markdown')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor:
              activeTab === 'markdown'
                ? theme.colors.background
                : 'transparent',
            color:
              activeTab === 'markdown'
                ? theme.colors.text
                : theme.colors.textSecondary,
            border: 'none',
            borderBottom:
              activeTab === 'markdown'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'markdown' ? 600 : 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'markdown') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'markdown') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <BookOpen size={16} />
          Markdown
        </button>
        <button
          onClick={() => handleTabChange('terminal')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor:
              activeTab === 'terminal'
                ? theme.colors.background
                : 'transparent',
            color:
              activeTab === 'terminal'
                ? theme.colors.text
                : theme.colors.textSecondary,
            border: 'none',
            borderBottom:
              activeTab === 'terminal'
                ? `2px solid ${theme.colors.primary}`
                : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'terminal' ? 600 : 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'terminal') {
              e.currentTarget.style.backgroundColor =
                theme.colors.backgroundTertiary;
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'terminal') {
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <TerminalIcon size={16} />
          Terminal
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {activeTab === 'preview' ? (
          <FilePreviewPanel
            filePath={filePath}
            source={source}
            onClose={onClose}
          />
        ) : activeTab === 'diff' ? (
          <GitDiffPanel
            relativeFilePath={selectionMode === 'diff' ? filePath : null}
            repositoryPath={repositoryPath}
            status={gitStatus}
            onClose={onClose}
          />
        ) : activeTab === 'markdown' ? (
          <MarkdownRenderingPanel
            filePath={filePath}
            source={source}
            onClose={onClose}
          />
        ) : (
          <TerminalPanel
            directory={repositoryPath}
            context="principal"
            isVisible={activeTab === 'terminal'}
            hideHeader={false}
          />
        )}
      </div>
    </div>
  );
};
