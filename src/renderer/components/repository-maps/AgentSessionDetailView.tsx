import React, { useState } from 'react';
import {
  FileText,
  Edit3,
  Activity,
  Clock,
  BookOpen,
  AlertCircle,
  GitCommit,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Package,
  Terminal,
  Database,
  Layers,
  Archive,
  EyeOff,
  Eye,
} from 'lucide-react';
import { useTheme } from '@a24z/industry-theme';
import type { SessionCardData } from '../../repo-manager/shared/AgentSessionCard';
import { AgentSessionService } from '../../main-process-api/AgentSessionService';
import { SessionEventsView } from './SessionEventsView';

interface AgentSessionDetailViewProps {
  cardData: SessionCardData | null;
  sessionColor: string;
  sources: Map<string, any>;
  repositoryPath: string;
  onOpenInEditor?: (filePath: string) => Promise<void>;
  onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
  onOpenTerminal?: () => void;
  hasTerminalWindow?: boolean; // Track if terminal window exists
  onShowContext?: () => void;
  onViewEvents?: () => void;
  onArchive?: () => void;
  onOpenPackageCommands?: (project: any) => Promise<void>;
  getTimeAgo: (timestamp: number) => string;
}

export const AgentSessionDetailView: React.FC<AgentSessionDetailViewProps> = ({
  cardData,
  sessionColor,
  sources,
  repositoryPath,
  onOpenInEditor,
  onOpenAllInEditor,
  onOpenTerminal,
  hasTerminalWindow = false,
  onShowContext,
  onViewEvents,
  onArchive,
  onOpenPackageCommands,
  getTimeAgo,
}) => {
  const { theme } = useTheme();
  const [viewMode, setViewMode] = useState<'files' | 'events'>('files');
  const [fileViewMode, setFileViewMode] = useState<'reads' | 'writes'>(
    'writes',
  );
  const [showLiveActivity, setShowLiveActivity] = useState(false);
  const [showProjects, setShowProjects] = useState(false);

  if (!cardData) {
    return (
      <div
        style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
          fontSize: '14px',
          height: '100%',
          textAlign: 'center',
        }}
      >
        <div>
          <Activity
            size={32}
            color={theme.colors.textSecondary}
            style={{ marginBottom: '12px' }}
          />
          <div>Select a session to view detailed information</div>
        </div>
      </div>
    );
  }

  const session = cardData.session;
  const sessionName = session.customName || session.sessionId.substring(0, 8);

  // Get git changes for this repository
  const gitSource = Array.from(sources.values()).find(
    (source) => source.source.path === repositoryPath,
  );
  const gitChanges = gitSource?.gitChanges;
  const filesWithGitChanges = new Set<string>();
  if (gitChanges) {
    gitChanges.created?.forEach((f: string) => filesWithGitChanges.add(f));
    gitChanges.modified?.forEach((f: string) => filesWithGitChanges.add(f));
    gitChanges.deleted?.forEach((f: string) => filesWithGitChanges.add(f));
  }

  // Separate files by operation type
  const readFiles = Array.from(cardData.fileOperations?.values() || []).filter(
    (fileOp) => fileOp.operations.some((op) => op.type === 'read'),
  );

  const modifiedFiles = Array.from(
    cardData.fileOperations?.values() || [],
  ).filter((fileOp) =>
    fileOp.operations.some((op) => op.type === 'write' || op.type === 'edit'),
  );

  const FileOperationsList = ({
    files,
    operationType,
  }: {
    files: any[];
    operationType: 'read' | 'write';
  }) => {
    if (files.length === 0) {
      return (
        <div
          style={{
            color: theme.colors.textSecondary,
            fontSize: '12px',
            padding: '16px',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          No {operationType === 'read' ? 'files read' : 'files modified'} in
          this session
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {files.map((fileOp, index) => {
          const hasGitChanges = filesWithGitChanges.has(
            fileOp.relativePath || fileOp.path,
          );
          const hasCollision = (fileOp as any).hasCollision;
          const agentCount = (fileOp as any).agentCount;
          const fileName =
            fileOp.path?.split('/').pop() || fileOp.path || 'Unknown';
          const relativePath = fileOp.relativePath || fileOp.path;

          return (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: theme.colors.backgroundSecondary,
                borderRadius: '6px',
                border: `1px solid ${hasCollision ? theme.colors.error + '40' : hasGitChanges ? theme.colors.warning + '40' : theme.colors.border}`,
                fontSize: '12px',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onClick={() => {
                const fullPath = fileOp.relativePath
                  ? `${repositoryPath}/${fileOp.relativePath}`
                  : fileOp.path;
                onOpenInEditor?.(fullPath);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  theme.colors.backgroundSecondary;
              }}
            >
              {hasCollision ? (
                <AlertCircle size={14} color={theme.colors.error} />
              ) : operationType === 'read' ? (
                <BookOpen size={14} color={theme.colors.primary} />
              ) : (
                <Edit3
                  size={14}
                  color={
                    hasGitChanges ? theme.colors.warning : theme.colors.success
                  }
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: 'monospace',
                    color: hasCollision
                      ? theme.colors.error
                      : hasGitChanges
                        ? theme.colors.text
                        : theme.colors.textSecondary,
                    fontWeight: 500,
                    marginBottom: '2px',
                  }}
                >
                  {fileName}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {relativePath}
                </div>
              </div>

              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {hasCollision && (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      backgroundColor: theme.colors.error + '20',
                      color: theme.colors.error,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {agentCount} Agents
                  </span>
                )}
                {hasGitChanges && !hasCollision && (
                  <span
                    style={{
                      fontSize: '9px',
                      padding: '2px 6px',
                      borderRadius: '12px',
                      backgroundColor: theme.colors.warning + '20',
                      color: theme.colors.warning,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Uncommitted
                  </span>
                )}

                <ExternalLink size={12} color={theme.colors.textTertiary} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: theme.colors.background,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          backgroundColor: theme.colors.backgroundSecondary,
          borderBottom: `1px solid ${theme.colors.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: sessionColor,
                flexShrink: 0,
              }}
            />
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              <div
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                {sessionName}
              </div>
              {/* Session Stats moved here */}
              <div
                style={{
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <BookOpen size={12} />
                  {readFiles.length} reads
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Edit3 size={12} />
                  {modifiedFiles.length} writes
                </div>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Clock size={12} />
                  {getTimeAgo(session.lastActivity || session.firstAccess)}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons on the right */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Toggle Live Activity button */}
            <button
              onClick={() => setShowLiveActivity(!showLiveActivity)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.textSecondary,
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={
                showLiveActivity ? 'Hide live activity' : 'Show live activity'
              }
            >
              {showLiveActivity ? <EyeOff size={12} /> : <Eye size={12} />}
              {showLiveActivity ? 'Hide Activity' : 'Show Activity'}
            </button>

            {/* Focus Terminal button */}
            {onOpenTerminal && (
              <button
                onClick={onOpenTerminal}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 12px',
                  backgroundColor: hasTerminalWindow
                    ? theme.colors.primary
                    : theme.colors.success,
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                title={
                  hasTerminalWindow
                    ? 'Focus existing terminal window'
                    : 'Open new terminal window'
                }
              >
                <Terminal size={12} />
                {hasTerminalWindow ? 'Focus Terminal' : 'Open Terminal'}
              </button>
            )}
          </div>
        </div>

        {/* Live Events Section - Conditionally rendered */}
        {showLiveActivity && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: theme.colors.background,
              borderRadius: '6px',
              border: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: theme.colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 600,
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Activity size={12} color={theme.colors.primary} />
              Live Activity
            </div>

            {cardData.latestEvent ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: sessionColor, fontWeight: 600 }}>
                    {cardData.latestEvent.toolName}
                  </span>
                  {cardData.latestEvent.fileName && (
                    <>
                      <span style={{ color: theme.colors.textSecondary }}>
                        →
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: theme.colors.text,
                        }}
                      >
                        {cardData.latestEvent.fileName}
                      </span>
                    </>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textSecondary,
                    fontFamily: 'monospace',
                  }}
                >
                  {new Date(
                    cardData.latestEvent.timestamp,
                  ).toLocaleTimeString()}
                </span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: '12px',
                  color: theme.colors.textSecondary,
                  fontStyle: 'italic',
                }}
              >
                No recent activity
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '12px',
          }}
        >
          {/* Files button */}
          <button
            onClick={() => setViewMode('files')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              backgroundColor:
                viewMode === 'files' ? theme.colors.primary : 'transparent',
              border:
                viewMode === 'files'
                  ? 'none'
                  : `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: viewMode === 'files' ? '#fff' : theme.colors.text,
              fontSize: '11px',
              fontWeight: viewMode === 'files' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FileText size={12} />
            Files
          </button>

          {/* Events button */}
          <button
            onClick={() => setViewMode('events')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              backgroundColor:
                viewMode === 'events' ? theme.colors.primary : 'transparent',
              border:
                viewMode === 'events'
                  ? 'none'
                  : `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              color: viewMode === 'events' ? '#fff' : theme.colors.text,
              fontSize: '11px',
              fontWeight: viewMode === 'events' ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={12} />
            Events
          </button>

          {onArchive && !cardData.hasUncommittedChanges && (
            <button
              onClick={() => {
                if (
                  confirm(
                    `Archive session "${cardData.session.customName || cardData.session.sessionId.substring(0, 8)}"?`,
                  )
                ) {
                  onArchive();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px',
                color: theme.colors.textSecondary,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Archive this session (no uncommitted changes)"
            >
              <Archive size={12} />
              Archive Session
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {viewMode === 'files' ? (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {/* File View Toggle and Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            {/* Left side: Section title with count */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: theme.colors.text,
                }}
              >
                {fileViewMode === 'writes' ? (
                  <>
                    <Edit3 size={16} color={theme.colors.primary} />
                    Files Modified ({modifiedFiles.length})
                  </>
                ) : (
                  <>
                    <BookOpen size={16} color={theme.colors.primary} />
                    Files Read ({readFiles.length})
                  </>
                )}
              </div>

              {/* Open All button next to title */}
              {onOpenAllInEditor && (
                <button
                  onClick={() => {
                    const files =
                      fileViewMode === 'writes' ? modifiedFiles : readFiles;
                    const filePaths = files.map((fileOp) =>
                      fileOp.relativePath
                        ? `${repositoryPath}/${fileOp.relativePath}`
                        : fileOp.path,
                    );
                    onOpenAllInEditor(filePaths);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor:
                      fileViewMode === 'writes'
                        ? theme.colors.primary + '20'
                        : 'transparent',
                    border: `1px solid ${
                      fileViewMode === 'writes'
                        ? theme.colors.primary
                        : theme.colors.border
                    }`,
                    borderRadius: '4px',
                    color:
                      fileViewMode === 'writes'
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: fileViewMode === 'writes' ? 600 : 400,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <ExternalLink size={10} />
                  Open All
                </button>
              )}
            </div>

            {/* Right side: Toggle switch */}
            <div
              style={{
                display: 'flex',
                gap: '2px',
                backgroundColor: theme.colors.background,
                borderRadius: '6px',
                padding: '2px',
                border: `1px solid ${theme.colors.border}`,
              }}
            >
              <button
                onClick={() => setFileViewMode('reads')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor:
                    fileViewMode === 'reads'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    fileViewMode === 'reads'
                      ? '#fff'
                      : theme.colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <BookOpen size={12} />
                Read
              </button>
              <button
                onClick={() => setFileViewMode('writes')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor:
                    fileViewMode === 'writes'
                      ? theme.colors.primary
                      : 'transparent',
                  color:
                    fileViewMode === 'writes'
                      ? '#fff'
                      : theme.colors.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Edit3 size={12} />
                Modified
              </button>
            </div>
          </div>

          {/* File List */}
          <div style={{ marginBottom: '20px' }}>
            <FileOperationsList
              files={fileViewMode === 'writes' ? modifiedFiles : readFiles}
              operationType={fileViewMode === 'writes' ? 'write' : 'read'}
            />
          </div>

          {/* Touched Projects Section */}
          {cardData.touchedProjects && cardData.touchedProjects.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.colors.text,
                  }}
                >
                  <Package size={16} color={theme.colors.primary} />
                  Projects Touched ({cardData.touchedProjects.length})
                </div>

                <button
                  onClick={() => setShowProjects(!showProjects)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'transparent',
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '4px',
                    color: theme.colors.textSecondary,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s',
                  }}
                >
                  {showProjects ? 'Hide' : 'Show'}
                  {showProjects ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                </button>
              </div>

              {showProjects && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {cardData.touchedProjects.map((project, index) => (
                    <div
                      key={index}
                      onClick={() => onOpenPackageCommands?.(project)}
                      style={{
                        padding: '12px',
                        backgroundColor: theme.colors.backgroundSecondary,
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '6px',
                        cursor: onOpenPackageCommands ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (onOpenPackageCommands) {
                          e.currentTarget.style.backgroundColor =
                            theme.colors.background;
                          e.currentTarget.style.borderColor =
                            theme.colors.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (onOpenPackageCommands) {
                          e.currentTarget.style.backgroundColor =
                            theme.colors.backgroundSecondary;
                          e.currentTarget.style.borderColor =
                            theme.colors.border;
                        }
                      }}
                      title={
                        onOpenPackageCommands
                          ? `Click to run commands for ${project.name}`
                          : undefined
                      }
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                        }}
                      >
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: theme.colors.text,
                          }}
                        >
                          {project.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '12px',
                              backgroundColor: project.hasWrites
                                ? theme.colors.primary + '20'
                                : theme.colors.backgroundTertiary,
                              color: project.hasWrites
                                ? theme.colors.primary
                                : theme.colors.textSecondary,
                              fontWeight: 600,
                            }}
                          >
                            {project.fileCount} files
                          </div>
                          {onOpenPackageCommands && (
                            <Terminal
                              size={14}
                              color={theme.colors.textSecondary}
                            />
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          fontFamily: 'monospace',
                          marginBottom:
                            project.availableCommands &&
                            project.availableCommands.length > 0
                              ? '8px'
                              : 0,
                        }}
                      >
                        {project.path}
                      </div>

                      {/* Display first 5 commands if available */}
                      {project.availableCommands &&
                        project.availableCommands.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: `1px solid ${theme.colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                fontSize: '10px',
                                color: theme.colors.textSecondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                fontWeight: 600,
                                marginBottom: '4px',
                              }}
                            >
                              Available Commands
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px',
                              }}
                            >
                              {project.availableCommands.map(
                                (cmd, cmdIndex) => (
                                  <div
                                    key={cmdIndex}
                                    title={cmd.description || cmd.command}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 6px',
                                      backgroundColor:
                                        cmd.type === 'script'
                                          ? theme.colors.primary + '15'
                                          : theme.colors.backgroundTertiary,
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      color:
                                        cmd.type === 'script'
                                          ? theme.colors.primary
                                          : theme.colors.textSecondary,
                                      border: `1px solid ${
                                        cmd.type === 'script'
                                          ? theme.colors.primary + '30'
                                          : theme.colors.border
                                      }`,
                                      cursor: 'default',
                                    }}
                                  >
                                    <Terminal size={10} />
                                    <span>{cmd.name}</span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Events View */
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <SessionEventsView
            sessionId={cardData.session.sessionId}
            sessionName={
              cardData.session.customName ||
              cardData.session.sessionId.substring(0, 8)
            }
          />
        </div>
      )}
    </div>
  );
};
