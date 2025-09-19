import React, { useState, useCallback } from 'react';
import { AnimatedResizableLayout } from '@a24z/panels';
import '@a24z/panels/style.css';
import { useTheme } from 'themed-markdown';
import { Sparkles, X } from 'lucide-react';
import { ArchivedAgentSessionsPanel } from '../components/repository-maps/ArchivedAgentSessionsPanel';
import { SessionDetailsPanel } from '../components/agent-overview/SessionDetailsPanel';
import type { AgentSessionRecord } from '../../shared/sessionTypes';

interface ArchivedSessionsViewerProps {
  initialSessionId?: string;
  initialDirectory?: string;
}

export const ArchivedSessionsViewer: React.FC<ArchivedSessionsViewerProps> = ({
  initialSessionId,
  initialDirectory,
}) => {
  const { theme } = useTheme();
  const [selectedSession, setSelectedSession] = useState<{
    sessionId: string;
    directory: string;
    session?: AgentSessionRecord;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'files' | 'tools' | 'timeline'>(
    'files',
  );
  const [knipAnalysis, setKnipAnalysis] = useState<any>(null);
  const [runningKnip, setRunningKnip] = useState(false);
  const [analyzingRepos, setAnalyzingRepos] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [visibleSession, setVisibleSession] = useState<{
    sessionId: string;
    directory: string;
  } | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false); // Collapsed if opened with initial session
  const [currentRepositoryPath, setCurrentRepositoryPath] = useState<string>(
    initialDirectory || '',
  );

  // Load initial session if provided
  React.useEffect(() => {
    if (initialSessionId && initialDirectory) {
      setSelectedSession({
        sessionId: initialSessionId,
        directory: initialDirectory,
      });
      setVisibleSession({
        sessionId: initialSessionId,
        directory: initialDirectory,
      });
    }
  }, [initialSessionId, initialDirectory]);

  // Add CSS animation for loading shimmer
  React.useEffect(() => {
    const styleId = 'agent-overview-animations';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Memoize the session select handler to prevent unnecessary re-renders
  const handleSessionSelect = useCallback(
    (session: AgentSessionRecord, directory: string) => {
      // If we're switching sessions, trigger fade out first
      if (
        visibleSession &&
        (visibleSession.sessionId !== session.sessionId ||
          visibleSession.directory !== directory)
      ) {
        setIsFadingOut(true);
        setTimeout(() => {
          setSelectedSession({
            sessionId: session.sessionId,
            directory,
            session,
          });
          setVisibleSession({ sessionId: session.sessionId, directory });
          setIsFadingOut(false);
        }, 500); // Match the transition duration
      } else {
        // First selection, no fade out needed
        setSelectedSession({
          sessionId: session.sessionId,
          directory,
          session,
        });
        setVisibleSession({ sessionId: session.sessionId, directory });
      }
    },
    [visibleSession],
  );

  // Always show SessionDetailsPanel when we have a session selected
  // It will handle its own loading states internally
  const rightPanel = visibleSession ? (
    <div
      style={{
        height: '100%',
        opacity: isFadingOut ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
      }}
    >
      <SessionDetailsPanel
        sessionId={visibleSession.sessionId}
        directory={visibleSession.directory}
        initialSession={selectedSession?.session}
        viewMode={viewMode}
        setViewMode={setViewMode}
        knipAnalysis={knipAnalysis}
        setKnipAnalysis={setKnipAnalysis}
        runningKnip={runningKnip}
        setRunningKnip={setRunningKnip}
        analyzingRepos={analyzingRepos}
        setAnalyzingRepos={setAnalyzingRepos}
        onSessionDeleted={() => {
          setIsFadingOut(true);
          setTimeout(() => {
            setSelectedSession(null);
            setVisibleSession(null);
            setIsFadingOut(false);
          }, 500);
        }}
      />
    </div>
  ) : (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
        color: theme.colors.textSecondary,
      }}
    >
      <p>Select a session to view details</p>
    </div>
  );

  return (
    <div
      style={{
        height: '100vh',
        backgroundColor: theme.colors.background,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          padding: '0 16px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 600,
              color: theme.colors.text,
              marginBottom: '4px',
            }}
          >
            Archived Sessions
          </h1>
          <div
            style={{
              fontSize: '12px',
              color: theme.colors.textSecondary,
              fontFamily: 'monospace',
            }}
          >
            {currentRepositoryPath || initialDirectory || 'All Repositories'}
          </div>
        </div>
        <div
          style={{
            fontSize: '13px',
            color: theme.colors.textTertiary,
          }}
        >
          Viewing archived agent sessions
        </div>
      </div>

      {/* Main content with resizable layout */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnimatedResizableLayout
          leftPanel={
            <ArchivedAgentSessionsPanel
              repositoryPath={
                currentRepositoryPath || selectedSession?.directory || ''
              }
              repositoryName={
                currentRepositoryPath
                  ? currentRepositoryPath.split('/').pop() || 'Repository'
                  : 'All Archives'
              }
              onSessionSelect={(session, directory) => {
                handleSessionSelect(session as any, directory);
                // Update repository path when a session is selected
                if (directory && directory !== currentRepositoryPath) {
                  setCurrentRepositoryPath(directory);
                }
              }}
              onSessionUnselect={() => {
                setSelectedSession(null);
                setVisibleSession(null);
              }}
              selectedSessionId={selectedSession?.sessionId || undefined}
              sessionLayerFilters={new Map()}
              onSessionLayerFilterChange={() => {}}
              onLayersGenerated={() => {}}
              selectedSessionIds={new Set()}
            />
          }
          rightPanel={rightPanel}
          defaultSize={25}
          minSize={25}
          collapsibleSide="left"
          showCollapseButton
          collapsed={isPanelCollapsed}
        />
      </div>

      {/* Knip Analysis Modal */}
      {knipAnalysis && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: theme.colors.backgroundTertiary,
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '1024px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                Tech Debt Analysis
              </h3>
              <button
                onClick={() => setKnipAnalysis(null)}
                style={{
                  padding: '4px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  color: theme.colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                  e.currentTarget.style.color = theme.colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }}
              >
                <X size={20} />
              </button>
            </div>

            {knipAnalysis.error ? (
              <div
                style={{
                  color: theme.colors.error,
                  backgroundColor: `${theme.colors.error}20`,
                  borderRadius: '4px',
                  padding: '16px',
                }}
              >
                <p style={{ fontWeight: 500, marginBottom: '8px' }}>
                  Analysis Failed
                </p>
                <pre style={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                  {knipAnalysis.error}
                </pre>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="text-3xl font-bold text-white">
                      {knipAnalysis.unusedFiles?.length || 0}
                    </div>
                    <div
                      className="text-sm mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Unused Files
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="text-3xl font-bold text-white">
                      {knipAnalysis.unusedExports?.length || 0}
                    </div>
                    <div
                      className="text-sm mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Unused Exports
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="text-3xl font-bold text-white">
                      {knipAnalysis.unusedDependencies?.length || 0}
                    </div>
                    <div
                      className="text-sm mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Unused Dependencies
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <div className="text-3xl font-bold text-white">
                      {knipAnalysis.unresolvedImports?.length || 0}
                    </div>
                    <div
                      className="text-sm mt-1"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      Unresolved Imports
                    </div>
                  </div>
                </div>

                {/* Detailed Results */}
                {knipAnalysis.unusedFiles?.length > 0 && (
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <h4 className="font-medium text-white mb-3">
                      Unused Files
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {knipAnalysis.unusedFiles.map(
                        (file: string, idx: number) => (
                          <div
                            key={idx}
                            className="text-sm font-mono rounded px-3 py-1 truncate"
                            style={{
                              color: theme.colors.textTertiary,
                              backgroundColor: theme.colors.surface,
                            }}
                            title={file}
                          >
                            {file}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {knipAnalysis.unusedExports?.length > 0 && (
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <h4 className="font-medium text-white mb-3">
                      Unused Exports
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {knipAnalysis.unusedExports.map(
                        (item: any, idx: number) => (
                          <div
                            key={idx}
                            className="rounded p-2"
                            style={{ backgroundColor: theme.colors.surface }}
                          >
                            <p
                              className="text-sm font-mono"
                              style={{ color: theme.colors.textTertiary }}
                            >
                              {item.file}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: theme.colors.textSecondary }}
                            >
                              Export: {item.export}
                            </p>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {knipAnalysis.unusedDependencies?.length > 0 && (
                  <div
                    className="rounded-lg p-4"
                    style={{ backgroundColor: theme.colors.background }}
                  >
                    <h4 className="font-medium text-white mb-3">
                      Unused Dependencies
                    </h4>
                    <div className="space-y-1">
                      {knipAnalysis.unusedDependencies.map(
                        (dep: string, idx: number) => (
                          <div
                            key={idx}
                            className="text-sm font-mono"
                            style={{ color: theme.colors.textTertiary }}
                          >
                            {dep}
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {!knipAnalysis.unusedFiles?.length &&
                  !knipAnalysis.unusedExports?.length &&
                  !knipAnalysis.unusedDependencies?.length &&
                  !knipAnalysis.unresolvedImports?.length && (
                    <div
                      className="text-center py-8"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      <p className="text-lg mb-2 flex items-center justify-center gap-2">
                        <Sparkles size={16} /> No tech debt found!
                      </p>
                      <p className="text-sm">
                        This project directory appears to be clean.
                      </p>
                    </div>
                  )}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setKnipAnalysis(null)}
                className="px-4 py-2 text-white rounded-md transition-colors"
                style={{ backgroundColor: theme.colors.backgroundHover }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    theme.colors.backgroundHover;
                }}
              >
                Close
              </button>
              {knipAnalysis.hasIssues && (
                <button
                  onClick={() => {
                    // TODO: Implement selective fix functionality
                    console.log('Fix selected issues');
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  Fix Selected Issues
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
