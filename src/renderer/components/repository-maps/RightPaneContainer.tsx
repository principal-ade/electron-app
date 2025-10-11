import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Map as MapIcon, HelpCircle, FileText, Layers } from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { CityData, HighlightLayer } from '@principal-ai/code-city-react';
import {
  RepositoryToolbar,
  ToolbarItem,
} from '../../repo-manager/shared/RepositoryToolbar';

import { RepositoryNote } from '../../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
import type { SessionFileActivity } from '../../types/file-activity.types';

import { ArchitectureMapHighlightLayers } from '@principal-ai/code-city-react';
// Notes panel removed - will be integrated into AgentSessionDetailView
import { EmptyState } from './EmptyState';
import { LoadingAnimation } from './LoadingAnimation';
import { AgentSessionDetailView } from './AgentSessionDetailView';
import { SessionCardData } from '../../repo-manager/shared/AgentSessionCard';
import { GitChangesHelpModal } from './GitChangesHelpModal';
import { FileTreeSource } from '../../types/file-tree-source';

export type RightPaneView = 'city' | 'session-detail' | 'document';

interface RightPaneContainerProps {
  // Current view mode
  activeView: RightPaneView;
  onViewChange: (view: RightPaneView) => void;

  // City view props
  cityData: CityData | null;
  highlightLayers?: HighlightLayer[];
  loading?: boolean;
  treeStats?: { fileCount: number; directoryCount: number } | null;
  onFileClick?: (filePath: string) => void;

  // Source for git changes
  activeSource?: FileTreeSource | null;

  // Session detail props (notes will be integrated here in the future)
  sessions: EnhancedUIAgentSessionData[];
  sessionFileActivities: Map<string, SessionFileActivity[]>;
  selectedSessionId?: string;
  repository?: {
    name: string;
    localClones?: Array<{ path: string }>;
  };

  // Event handlers
  onNoteCreated?: (note: RepositoryNote) => void;
  onHelpClick?: () => void;

  // Optional header badges/extras
  headerExtra?: React.ReactNode;
  sourceBadges?: React.ReactNode;

  // Session detail props
  selectedSessionCardData?: SessionCardData | null;
  sessionColor?: string;
  repositoryPath?: string;
  sources?: Map<string, any>; // File change sources
  onOpenInEditor?: (filePath: string) => Promise<void>;
  onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
  onOpenTerminal?: () => void;
  hasTerminalWindow?: boolean;
  onShowContext?: () => void;
  onViewEvents?: () => void;
  onArchive?: () => void;
  onOpenPackageCommands?: (project: any) => Promise<void>;
  getTimeAgo?: (timestamp: number) => string;

  // Messages
  loadingMessage?: string;
  emptyMessage?: string;

  // Control visibility of view switcher
  showViewSwitcher?: boolean;

  // Toolbar configuration
  toolbarItems?: ToolbarItem[];
  toolbarExpanded?: boolean;
  onToolbarExpandedChange?: (expanded: boolean) => void;

  // Document view props
  documentContent?: React.ReactNode;
}

interface NoteNotification {
  note: RepositoryNote;
  timestamp: number;
  position?: { x: number; y: number };
}

export const RightPaneContainer: React.FC<RightPaneContainerProps> = ({
  activeView,
  onViewChange,
  cityData,
  highlightLayers,
  loading = false,
  treeStats,
  onFileClick,
  activeSource,
  sessions,
  sessionFileActivities,
  selectedSessionId,
  repository,
  onNoteCreated,
  onHelpClick,
  headerExtra,
  sourceBadges,
  loadingMessage = 'Building your city',
  emptyMessage = 'No city data available',
  showViewSwitcher = true,
  selectedSessionCardData,
  sessionColor = '#3b82f6',
  repositoryPath = '',
  sources = new Map(),
  onOpenInEditor,
  onOpenAllInEditor,
  onOpenTerminal,
  hasTerminalWindow = false,
  onShowContext,
  onViewEvents,
  onArchive,
  onOpenPackageCommands,
  getTimeAgo = (ts) => 'recently',
  toolbarItems = [],
  toolbarExpanded = false,
  onToolbarExpandedChange,
  documentContent,
}) => {
  const { theme } = useTheme();
  const [recentNotes, setRecentNotes] = useState<NoteNotification[]>([]);
  const [showingNotification, setShowingNotification] = useState(false);
  const [showGitChangesHelp, setShowGitChangesHelp] = useState(false);
  const internalTerminalRef = useRef<{
    addClaudeSession: (sessionId: string, sessionName?: string) => void;
  }>(null);

  // Hover information state
  const [hoverInfo, setHoverInfo] = useState<{
    hoveredDistrict: any | null;
    hoveredBuilding: any | null;
    fileTooltip: { text: string } | null;
    directoryTooltip: { text: string } | null;
    fileCount: number | null;
  } | null>(null);

  // Memoize the hover handler to prevent infinite re-renders
  const handleHover = useCallback(
    (info: {
      hoveredDistrict: any | null;
      hoveredBuilding: any | null;
      fileTooltip: { text: string } | null;
      directoryTooltip: { text: string } | null;
      fileCount: number | null;
    }) => {
      setHoverInfo(info);
    },
    [],
  );

  // Listen for note creation events (placeholder for future implementation)
  useEffect(() => {
    if (onNoteCreated) {
      // This will be connected to IPC events in the future
      // For now, it's just a placeholder
    }
  }, [onNoteCreated]);

  // Handle notification display
  useEffect(() => {
    if (recentNotes.length > 0) {
      setShowingNotification(true);
      const timer = setTimeout(() => {
        setShowingNotification(false);
        // Remove oldest notification after animation
        setTimeout(() => {
          setRecentNotes((prev) => prev.slice(1));
        }, 300);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [recentNotes]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.backgroundSecondary,
        borderRadius: '0', // No border radius - handled by parent
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Header with view switcher */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderBottom: `1px solid ${theme.colors.border}`,
          backgroundColor: theme.colors.backgroundLight,
        }}
      >
        {/* First row: Title, stats, and view switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: 1,
            }}
          >
            {activeView === 'city' && (
              <MapIcon size={18} color={theme.colors.primary} />
            )}
            {/* Notes view removed - integrated into session detail */}
            {activeView === 'session-detail' && (
              <FileText size={18} color={theme.colors.primary} />
            )}
            {activeView === 'document' && (
              <FileText size={18} color={theme.colors.primary} />
            )}

            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: theme.colors.text,
                margin: 0,
              }}
            >
              {activeView === 'city' && 'Project Structure'}
              {activeView === 'document' && 'Documentation'}
              {/* Notes view removed - integrated into session detail */}
              {activeView === 'session-detail' &&
                (selectedSessionCardData?.session?.customName ||
                  selectedSessionCardData?.session?.sessionId?.substring(
                    0,
                    8,
                  ) ||
                  'Session Details')}
            </h3>

            {/* Show stats for city view */}
            {activeView === 'city' && treeStats && (
              <span
                style={{ fontSize: '13px', color: theme.colors.textSecondary }}
              >
                {treeStats.fileCount.toLocaleString()} files •{' '}
                {treeStats.directoryCount.toLocaleString()} directories
              </span>
            )}

            {headerExtra}
          </div>

          {/* View switcher buttons and help */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {showViewSwitcher &&
              (selectedSessionCardData || activeView === 'document') && (
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  {selectedSessionCardData && (
                    <button
                      onClick={() => onViewChange('session-detail')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        backgroundColor:
                          activeView === 'session-detail'
                            ? theme.colors.primary
                            : 'transparent',
                        color:
                          activeView === 'session-detail'
                            ? '#fff'
                            : theme.colors.textSecondary,
                      }}
                    >
                      Session
                    </button>
                  )}
                  {activeView === 'document' && (
                    <>
                      <button
                        onClick={() => onViewChange('document')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          backgroundColor: theme.colors.primary,
                          color: '#fff',
                        }}
                      >
                        Document
                      </button>
                      <button
                        onClick={() => onViewChange('city')}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          fontSize: 12,
                          backgroundColor: 'transparent',
                          color: theme.colors.textSecondary,
                        }}
                      >
                        Map
                      </button>
                    </>
                  )}
                  {activeView === 'city' && (
                    <button
                      onClick={() => onViewChange('city')}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: 12,
                        backgroundColor: theme.colors.primary,
                        color: '#fff',
                      }}
                    >
                      Map
                    </button>
                  )}
                  {/* Notes button removed - integrated into session detail */}
                </div>
              )}

            {/* Help button */}
            {onHelpClick && (
              <button
                onClick={onHelpClick}
                style={{
                  padding: '4px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: theme.colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundTertiary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title="Help"
              >
                <HelpCircle size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Second row: Source badges and Git Changes (only show for city view) */}
        {activeView === 'city' &&
          (sourceBadges || (activeSource && activeSource.type === 'local')) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderTop: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.background,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {sourceBadges}
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {/* Help button */}
                {activeSource && activeSource.type === 'local' && (
                  <button
                    onClick={() => setShowGitChangesHelp(true)}
                    style={{
                      padding: '6px',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: theme.colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        theme.colors.backgroundTertiary;
                      e.currentTarget.style.color = theme.colors.text;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = theme.colors.textSecondary;
                    }}
                    title="Learn about git changes visualization"
                  >
                    <HelpCircle size={14} />
                  </button>
                )}

                {/* Toolbar toggle button */}
                {toolbarItems.length > 0 && (
                  <button
                    onClick={() => onToolbarExpandedChange?.(!toolbarExpanded)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: `1px solid ${theme.colors.border}`,
                      backgroundColor: toolbarExpanded
                        ? theme.colors.primary + '15'
                        : theme.colors.background,
                      color: toolbarExpanded
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!toolbarExpanded) {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.backgroundTertiary;
                        e.currentTarget.style.color = theme.colors.text;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!toolbarExpanded) {
                        e.currentTarget.style.backgroundColor =
                          theme.colors.background;
                        e.currentTarget.style.color =
                          theme.colors.textSecondary;
                      }
                    }}
                    title={
                      toolbarExpanded
                        ? 'Hide repository tools'
                        : 'Show repository tools'
                    }
                  >
                    <Layers size={12} />
                    <span>Tools</span>
                    {toolbarItems.filter((item) => item.active).length > 0 && (
                      <span
                        style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          backgroundColor: theme.colors.primary + '22',
                          color: theme.colors.primary,
                          fontSize: '10px',
                          fontWeight: 600,
                        }}
                      >
                        {toolbarItems.filter((item) => item.active).length}
                      </span>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Repository toolbar */}
      {toolbarItems.length > 0 && (
        <RepositoryToolbar
          items={toolbarItems}
          position="top"
          expanded={toolbarExpanded}
        />
      )}

      {/* Content area with all views rendered but visibility controlled */}
      <div
        style={{
          flex: '1 1 0',
          minHeight: 0, // Important for flexbox to allow shrinking
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* City View */}
        <div
          style={{
            flex: 1,
            visibility: activeView === 'city' ? 'visible' : 'hidden',
            zIndex: activeView === 'city' ? 2 : 1,
            backgroundColor: theme.colors.backgroundSecondary,
            pointerEvents: activeView === 'city' ? 'auto' : 'none',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {cityData ? (
            <>
              {/* Map Container */}
              <div style={{ flex: 1, position: 'relative' }}>
                <ArchitectureMapHighlightLayers
                  cityData={cityData}
                  highlightLayers={highlightLayers}
                  showLayerControls={false}
                  onLayerToggle={() => {}}
                  defaultDirectoryColor="#111827"
                  onFileClick={onFileClick || (() => {})}
                  showFileTypeIcons={true}
                  className="w-full h-full"
                  showLegend={false}
                  showDirectoryLabels={true}
                  onHover={handleHover}
                />
              </div>

              {/* Hover Information Bar - Always visible */}
              <div
                style={{
                  height: '56px',
                  borderTop: `1px solid ${theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 16px',
                  fontSize: '13px',
                  color: theme.colors.text,
                  gap: '16px',
                  flexShrink: 0,
                }}
              >
                {hoverInfo &&
                (hoverInfo.hoveredBuilding || hoverInfo.hoveredDistrict) ? (
                  <>
                    {/* File/Directory name and path */}
                    <div
                      style={{
                        flex: '1 1 auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        minWidth: 0,
                      }}
                    >
                      {/* Name (filename or last directory part) */}
                      <div
                        style={{
                          fontWeight: 600,
                          color: theme.colors.primary,
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {hoverInfo.fileTooltip?.text ||
                          hoverInfo.hoveredDistrict?.path?.split('/').pop() ||
                          hoverInfo.hoveredDistrict?.path ||
                          'Unknown'}
                      </div>
                      {/* Full path */}
                      <div
                        style={{
                          color: theme.colors.textSecondary,
                          fontSize: '11px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {hoverInfo.hoveredBuilding?.path ||
                          hoverInfo.hoveredDistrict?.path ||
                          '/'}
                      </div>
                    </div>

                    {/* File count for directories */}
                    {hoverInfo.hoveredDistrict &&
                      hoverInfo.fileCount !== null && (
                        <div
                          style={{
                            color: theme.colors.textSecondary,
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          {hoverInfo.fileCount}{' '}
                          {hoverInfo.fileCount === 1 ? 'file' : 'files'}
                        </div>
                      )}
                  </>
                ) : (
                  /* Default help text when not hovering */
                  <div
                    style={{
                      color: theme.colors.textSecondary,
                      fontStyle: 'italic',
                    }}
                  >
                    Hover over files and directories to see details
                  </div>
                )}
              </div>
            </>
          ) : loading ? (
            <LoadingAnimation
              message={loadingMessage}
              fileCount={treeStats?.fileCount}
            />
          ) : (
            <EmptyState message={emptyMessage} />
          )}

          {/* Note notifications overlay - only visible when on city view */}
          {showingNotification && recentNotes.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: theme.colors.backgroundLight,
                border: `2px solid ${theme.colors.primary}`,
                borderRadius: '8px',
                padding: '12px',
                maxWidth: '300px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                animation: 'slideIn 0.3s ease-out',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: theme.colors.primary,
                  marginBottom: '8px',
                }}
              >
                New Tribal Knowledge
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: theme.colors.text,
                  lineHeight: 1.4,
                }}
              >
                {recentNotes[0].note.note.substring(0, 100)}...
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.colors.textSecondary,
                  marginTop: '6px',
                }}
              >
                {recentNotes[0].note.relativePath || '/'}
              </div>
            </div>
          )}
        </div>

        {/* Notes view removed - integrated into AgentSessionDetailView */}

        {/* Session Detail View */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: activeView === 'session-detail' ? 'visible' : 'hidden',
            zIndex: activeView === 'session-detail' ? 2 : 1,
            backgroundColor: theme.colors.backgroundSecondary,
            pointerEvents: activeView === 'session-detail' ? 'auto' : 'none',
            padding: '16px',
          }}
        >
          <AgentSessionDetailView
            cardData={selectedSessionCardData}
            sessionColor={sessionColor}
            sources={sources}
            repositoryPath={repositoryPath}
            onOpenInEditor={onOpenInEditor}
            onOpenAllInEditor={onOpenAllInEditor}
            onOpenTerminal={onOpenTerminal}
            hasTerminalWindow={hasTerminalWindow}
            onShowContext={onShowContext}
            onViewEvents={onViewEvents}
            onArchive={onArchive}
            onOpenPackageCommands={onOpenPackageCommands}
            getTimeAgo={getTimeAgo}
          />
        </div>

        {/* Document View */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            visibility: activeView === 'document' ? 'visible' : 'hidden',
            zIndex: activeView === 'document' ? 2 : 1,
            backgroundColor: theme.colors.background,
            pointerEvents: activeView === 'document' ? 'auto' : 'none',
            overflow: 'hidden',
          }}
        >
          {documentContent}
        </div>
      </div>

      {/* Animation styles */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Git Changes Help Modal */}
      <GitChangesHelpModal
        isOpen={showGitChangesHelp}
        onClose={() => setShowGitChangesHelp(false)}
      />
    </div>
  );
};
