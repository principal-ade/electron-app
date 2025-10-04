import React, { useState, useEffect } from 'react';
import { useTheme } from '@a24z/industry-theme';
import { FileText, Terminal as TerminalIcon } from 'lucide-react';
import { FilePreviewPanel } from './FilePreviewPanel';
import TerminalPanel from '../../../../components/Terminal/TerminalPanel';

interface RightPanelProps {
  filePath: string | null;
  repositoryPath: string;
  activeTab?: 'preview' | 'terminal';
  onTabChange?: (tab: 'preview' | 'terminal') => void;
  onClose?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  filePath,
  repositoryPath,
  activeTab: externalActiveTab,
  onTabChange,
  onClose,
}) => {
  const { theme } = useTheme();
  const [internalActiveTab, setInternalActiveTab] = useState<'preview' | 'terminal'>('terminal');

  // Use external tab if provided, otherwise use internal state
  const activeTab = externalActiveTab !== undefined ? externalActiveTab : internalActiveTab;

  const handleTabChange = (tab: 'preview' | 'terminal') => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };

  // Switch to preview tab when a file is selected
  useEffect(() => {
    if (filePath && activeTab === 'terminal') {
      handleTabChange('preview');
    }
  }, [filePath]);

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
            backgroundColor: activeTab === 'preview' ? theme.colors.background : 'transparent',
            color: activeTab === 'preview' ? theme.colors.text : theme.colors.textSecondary,
            border: 'none',
            borderBottom: activeTab === 'preview' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'preview' ? 600 : 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'preview') {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
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
          onClick={() => handleTabChange('terminal')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: activeTab === 'terminal' ? theme.colors.background : 'transparent',
            color: activeTab === 'terminal' ? theme.colors.text : theme.colors.textSecondary,
            border: 'none',
            borderBottom: activeTab === 'terminal' ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'terminal' ? 600 : 500,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'terminal') {
              e.currentTarget.style.backgroundColor = theme.colors.backgroundTertiary;
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
            repositoryPath={repositoryPath}
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
