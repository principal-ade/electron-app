import React, { ReactNode } from 'react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/panels.css';
import { usePanelsTheme } from '../../../theme/panelsTheme';
import {
  RightPaneContainer,
  RightPaneView,
} from '../../../components/repository-maps/RightPaneContainer';
import type { ToolbarItem } from './RepositoryToolbar';
import { EnhancedUIAgentSessionData } from '../../../types/session.types';
import { SessionFileActivity } from '../../../contexts/FileChangeContext';
import { SessionCardData } from './AgentSessionCard';
import { FileTreeSource } from '../../../types/file-tree-source';
import { RightPaneMode } from '../../../../shared/types/userPreferences.types';

export interface TabConfig {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  visible?: boolean;
}

interface RepositoryViewSkeletonProps {
  // Left panel configuration
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;

  // Right panel (Code City) configuration
  cityData: CityData | null;
  highlightLayers: HighlightLayer[];
  loading: boolean;
  treeStats?: { fileCount: number; directoryCount: number } | null;

  // Source management
  sourceBadges?: ReactNode;
  activeSource?: FileTreeSource | null;
  onHelpClick?: () => void;

  // Optional customization
  cityHeaderExtra?: ReactNode;
  loadingMessage?: string;
  emptyMessage?: string;
  onFileClick?: (filePath: string) => void;

  // Right pane configuration
  rightPaneMode?: RightPaneMode;
  onRightPaneModeChange?: (mode: RightPaneMode) => void;
  terminalDirectory?: string;
  terminalTabsRef?: React.RefObject<{
    addClaudeSession: (sessionId: string, sessionName?: string) => void;
  } | null>;
  showViewSwitcher?: boolean;

  // Session detail configuration (notes will be integrated here in the future)
  sessions?: EnhancedUIAgentSessionData[];
  sessionFileActivities?: Map<string, SessionFileActivity[]>;
  selectedSessionId?: string;
  repository?: {
    name: string;
    localClones?: Array<{ path: string }>;
  };

  // Session detail props
  selectedSessionCardData?: SessionCardData | null;
  sessionColor?: string;
  repositoryPath?: string;
  sources?: Map<string, any>;
  onOpenInEditor?: (filePath: string) => Promise<void>;
  onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
  onOpenTerminal?: () => void;
  onShowContext?: () => void;
  onViewEvents?: () => void;
  onArchive?: () => void;
  onOpenPackageCommands?: (project: any) => Promise<void>;
  getTimeAgo?: (timestamp: number) => string;

  // Toolbar configuration
  toolbarItems?: ToolbarItem[];
  toolbarExpanded?: boolean;
  onToolbarExpandedChange?: (expanded: boolean) => void;

  // Document view props
  documentContent?: React.ReactNode;
}

export const RepositoryViewSkeleton: React.FC<RepositoryViewSkeletonProps> = ({
  tabs,
  activeTab,
  onTabChange,
  cityData,
  highlightLayers,
  loading,
  treeStats,
  sourceBadges,
  activeSource,
  onHelpClick,
  cityHeaderExtra,
  loadingMessage = 'Building your city',
  emptyMessage = 'No city data available',
  onFileClick,
  rightPaneMode = 'city',
  onRightPaneModeChange,
  showViewSwitcher = true,
  sessions = [],
  sessionFileActivities = new Map(),
  selectedSessionId,
  repository,
  selectedSessionCardData,
  sessionColor,
  repositoryPath,
  sources,
  onOpenInEditor,
  onOpenAllInEditor,
  onOpenTerminal,
  onShowContext,
  onViewEvents,
  onArchive,
  onOpenPackageCommands,
  getTimeAgo,
  toolbarItems = [],
  toolbarExpanded = false,
  onToolbarExpandedChange,
  documentContent,
}) => {
  const { theme } = useTheme();
  const panelsTheme = usePanelsTheme();

  // Filter out hidden tabs
  const visibleTabs = tabs.filter((tab) => tab.visible !== false);
  const activeTabConfig = visibleTabs.find((tab) => tab.id === activeTab);

  // Left panel content
  const leftPanel = (
    <div
      style={{
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '8px 0 0 8px', // Round only left corners
        border: `1px solid ${theme.colors.border}`,
        borderRight: 'none', // Remove right border since resize handle will be there
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Tab Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)`,
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
          padding: '0 8px',
          flexShrink: 0,
        }}
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '12px 16px',
              backgroundColor: 'transparent',
              color:
                activeTab === tab.id
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
              border: 'none',
              borderBottom:
                activeTab === tab.id
                  ? `3px solid ${theme.colors.primary}`
                  : '3px solid transparent',
              marginBottom: activeTab === tab.id ? '-2px' : '-2px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: activeTab === tab.id ? 1 : 0.7,
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.opacity = '0.9';
                e.currentTarget.style.color = theme.colors.text;
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.opacity = '0.7';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }
            }}
          >
            {tab.icon}
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
        }}
      >
        {activeTabConfig?.content}
      </div>
    </div>
  );

  // Right panel content with adjusted border radius
  const rightPanel = (
    <div
      style={{
        borderRadius: '0 8px 8px 0', // Round only right corners
        border: `1px solid ${theme.colors.border}`,
        borderLeft: 'none', // Remove left border since resize handle will be there
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <RightPaneContainer
        activeView={rightPaneMode as RightPaneView}
        onViewChange={(view) => onRightPaneModeChange?.(view)}
        cityData={cityData}
        highlightLayers={highlightLayers}
        loading={loading}
        treeStats={treeStats}
        onFileClick={onFileClick}
        activeSource={activeSource}
        sessions={sessions}
        sessionFileActivities={sessionFileActivities}
        selectedSessionId={selectedSessionId}
        repository={repository}
        onHelpClick={onHelpClick}
        headerExtra={cityHeaderExtra}
        sourceBadges={sourceBadges}
        loadingMessage={loadingMessage}
        emptyMessage={emptyMessage}
        showViewSwitcher={showViewSwitcher}
        selectedSessionCardData={selectedSessionCardData}
        sessionColor={sessionColor}
        repositoryPath={repositoryPath}
        sources={sources}
        onOpenInEditor={onOpenInEditor}
        onOpenAllInEditor={onOpenAllInEditor}
        onOpenTerminal={onOpenTerminal}
        hasTerminalWindow={false}
        onShowContext={onShowContext}
        onViewEvents={onViewEvents}
        onArchive={onArchive}
        onOpenPackageCommands={onOpenPackageCommands}
        getTimeAgo={getTimeAgo}
        toolbarItems={toolbarItems}
        toolbarExpanded={toolbarExpanded}
        onToolbarExpandedChange={onToolbarExpandedChange}
        documentContent={documentContent}
      />
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <AnimatedResizableLayout
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        collapsibleSide="left"
        defaultSize={50}
        minSize={25}
        style={{ height: '100%', width: '100%' }}
        theme={panelsTheme}
      />
    </div>
  );
};
