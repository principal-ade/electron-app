import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Edit3,
  Activity,
  Clock,
  Edit2,
  Copy,
  Check,
  Circle,
  Package,
  BookOpen,
  Map,
  PlayCircle,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  Search,
  Sparkles,
} from 'lucide-react';
import type {
  FileOperation,
  TodoItem,
} from '../../../main-process-api/AgentSessionService';
import type { EnhancedUIAgentSessionData } from '../../../types/session.types';
import type { TouchedProject } from '../../../utils/sessionProjectMapping';
import type { NormalizedAgentSessionEvent } from '@principal-ai/agent-monitoring';
import { EventCarousel } from '../../../components/session-history/EventCarousel';
import { AgentSessionService } from '../../../main-process-api/AgentSessionService';

export interface SessionCardData {
  session: EnhancedUIAgentSessionData;
  isExpanded: boolean;
  hasUncommittedChanges?: boolean;
  fileOperations?: Map<string, FileOperation>;
  lastTodos?: TodoItem[];
  touchedProjects?: TouchedProject[];
  latestEvent?: {
    toolName: string;
    timestamp: number;
    fileName?: string;
    description?: string;
  };
  hasNewEvent?: boolean;
  previousEventCount?: number;
  eventCountUpdated?: boolean;
  lastEventTimestamp?: number;
  isRecentlyActive?: boolean;
  activityType?: 'active' | 'waiting' | null;
  stats?: {
    filesRead: number;
    filesWritten: number;
    toolCalls: number;
    lastActivity: Date;
  };
}

interface AgentSessionCardProps {
  cardData: SessionCardData;
  sessionColor: string;
  theme: any;
  sources: Map<string, any>;
  repositoryPath: string;

  // Edit state
  isEditingName: boolean;
  editingName: string;
  editInputRef: React.RefObject<HTMLInputElement>;

  // Other state
  isCopied: boolean;
  isArchiving: boolean;
  isShownOnMap?: boolean; // Whether this session is shown on the map

  // Callbacks
  onStartEditName: () => void;
  onSaveEditName: () => void;
  onCancelEditName: () => void;
  onEditNameChange: (name: string) => void;
  onCopySessionId: () => void;
  onOpenTerminal?: () => void;
  onShowContext?: () => void;
  onOpenPackageCommands: (
    project: TouchedProject,
    index: number,
  ) => Promise<void>;
  onOpenInEditor?: (filePath: string) => Promise<void>;
  onOpenAllInEditor?: (filePaths: string[]) => Promise<void>;
  onToggleShowOnMap?: () => void; // Toggle showing this session on the map
  onViewEvents?: () => void; // Open event viewer modal
  onHighlightFiles?: (
    files: string[],
    mode: 'single' | 'trail' | 'cumulative',
  ) => void; // Highlight files on map
  onSessionDetailSelect?: () => void; // Show session in detail view

  // Helper functions
  getTimeAgo: (timestamp: number) => string;
}

// Add shimmer animation CSS
const shimmerStyle = `
  @keyframes shimmer {
    0% {
      left: -100%;
    }
    100% {
      left: 200%;
    }
  }
`;

export const AgentSessionCard: React.FC<AgentSessionCardProps> = ({
  cardData,
  sessionColor,
  theme,
  sources,
  repositoryPath,
  isEditingName,
  editingName,
  editInputRef,
  isCopied,
  isArchiving,
  isShownOnMap,
  onStartEditName,
  onSaveEditName,
  onCancelEditName,
  onEditNameChange,
  onCopySessionId,
  onOpenTerminal,
  onShowContext,
  onOpenPackageCommands,
  onOpenInEditor,
  onOpenAllInEditor,
  onToggleShowOnMap,
  onViewEvents,
  onHighlightFiles,
  onSessionDetailSelect,
  getTimeAgo,
}) => {
  // Event carousel state
  const [showCarousel, setShowCarousel] = useState(false);
  const [events, setEvents] = useState<NormalizedAgentSessionEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  // Current task expanded state
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  // Details (header) visibility state
  const [showDetails, setShowDetails] = useState(false);
  // Terminal loading state
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  // Load events when carousel is toggled
  useEffect(() => {
    if (showCarousel && events.length === 0 && !loadingEvents) {
      setLoadingEvents(true);
      AgentSessionService.getSessionEvents(cardData.session.sessionId)
        .then((sessionEvents) => {
          if (sessionEvents) {
            setEvents(sessionEvents);
          }
        })
        .catch((error) => {
          console.error('Failed to load session events:', error);
        })
        .finally(() => {
          setLoadingEvents(false);
        });
    }
  }, [showCarousel, events.length, loadingEvents, cardData.session.sessionId]);

  // Handle event selection from carousel
  const handleEventSelect = useCallback(
    (event: any, files: string[]) => {
      // Highlight files on the map
      if (onHighlightFiles) {
        onHighlightFiles(files, 'single');
      }
    },
    [onHighlightFiles],
  );

  // Handle highlight mode change from carousel
  const handleHighlightModeChange = useCallback(
    (mode: 'single' | 'trail' | 'cumulative') => {
      // Get current event's files if carousel is showing
      if (showCarousel && events.length > 0 && onHighlightFiles) {
        // The carousel will call handleEventSelect with the current event
        // We just need to update the mode here if needed
      }
    },
    [showCarousel, events, onHighlightFiles],
  );

  return (
    <>
      <style>{shimmerStyle}</style>
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          overflow: 'hidden',
          transition: 'all 0.2s',
          flexShrink: 0,
          minHeight: 'auto',
        }}
      >
        {/* Current Task / Last Event Compartment - Moved to top */}
        {(() => {
          const hasTodos = cardData.lastTodos && cardData.lastTodos.length > 0;

          // If we have todos, prepare the todo data
          let todoToShow = null;
          if (hasTodos && cardData.lastTodos) {
            // Priority: in_progress > first pending > last completed
            const inProgressTodo = cardData.lastTodos.find(
              (t) => t.status === 'in_progress',
            );
            const pendingTodos = cardData.lastTodos.filter(
              (t) => t.status === 'pending',
            );
            const completedTodos = cardData.lastTodos.filter(
              (t) => t.status === 'completed',
            );

            todoToShow =
              inProgressTodo ||
              pendingTodos[0] ||
              completedTodos[completedTodos.length - 1];
          }

          return (
            <div
              style={{
                padding: '16px',
                backgroundColor: theme.colors.backgroundTertiary,
                borderBottom: `1px solid ${theme.colors.border}`,
              }}
            >
              {/* Current Task Header - Clickable */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTaskExpanded(!isTaskExpanded);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
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
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {hasTodos ? 'Current Task' : 'Last Event'}
                  </div>
                  {/* Status Badge */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      backgroundColor: cardData.session.statusColor + '20',
                      color: cardData.session.statusColor,
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    <div
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '2px',
                        backgroundColor: cardData.session.statusColor,
                      }}
                    />
                    {cardData.session.statusText}
                  </span>
                </div>
                {/* Details Button and Expand/Collapse Caret */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {/* Resume Button - Opens terminal in new window */}
                  {onOpenTerminal && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        console.log('[AgentSessionCard] Resume button clicked');
                        setIsTerminalLoading(true);
                        try {
                          await onOpenTerminal();
                        } finally {
                          // Keep loading for a moment to show the window is opening
                          setTimeout(() => setIsTerminalLoading(false), 1500);
                        }
                      }}
                      disabled={isTerminalLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        backgroundColor: isTerminalLoading
                          ? theme.colors.backgroundTertiary
                          : theme.colors.primary,
                        border: 'none',
                        borderRadius: '4px',
                        color: isTerminalLoading
                          ? theme.colors.textSecondary
                          : '#fff',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: isTerminalLoading ? 'wait' : 'pointer',
                        transition: 'all 0.2s',
                        position: 'relative',
                        overflow: 'hidden',
                        minWidth: '55px',
                      }}
                      title={
                        isTerminalLoading
                          ? 'Opening terminal...'
                          : 'Resume session in terminal'
                      }
                    >
                      {isTerminalLoading && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: '-100%',
                            width: '100%',
                            height: '100%',
                            background: `linear-gradient(90deg, 
                          transparent 0%, 
                          ${theme.colors.primary}40 50%, 
                          transparent 100%)`,
                            animation: 'shimmer 1.5s infinite',
                          }}
                        />
                      )}
                      <span style={{ position: 'relative', zIndex: 1 }}>
                        {isTerminalLoading ? 'Opening...' : 'Resume'}
                      </span>
                    </button>
                  )}
                  {/* Details Button - Opens detail view */}
                  {onSessionDetailSelect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(
                          '[AgentSessionCard] Details button clicked',
                        );
                        onSessionDetailSelect();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        backgroundColor: 'transparent',
                        border: `1px solid ${theme.colors.border}`,
                        borderRadius: '4px',
                        color: theme.colors.textSecondary,
                        fontSize: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      title="Open detail view"
                    >
                      Details
                    </button>
                  )}
                  {/* Debug Toggle Button - Shows card header */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDetails(!showDetails);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      backgroundColor: showDetails
                        ? theme.colors.primary + '20'
                        : 'transparent',
                      border: `1px solid ${showDetails ? theme.colors.primary : theme.colors.border}`,
                      borderRadius: '4px',
                      color: showDetails
                        ? theme.colors.primary
                        : theme.colors.textSecondary,
                      fontSize: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontWeight: showDetails ? 600 : 400,
                    }}
                    title={showDetails ? 'Hide debug info' : 'Show debug info'}
                  >
                    Debug
                  </button>
                  {/* Expand/Collapse Caret */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      color: theme.colors.textSecondary,
                    }}
                  >
                    {isTaskExpanded ? (
                      <ChevronUp size={12} />
                    ) : (
                      <ChevronDown size={12} />
                    )}
                  </div>
                </div>
              </div>

              {/* Current Task or Last Event Display */}
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                {hasTodos && todoToShow ? (
                  // Show todo information
                  <>
                    {todoToShow.status === 'completed' ? (
                      <Check size={14} color={theme.colors.success} />
                    ) : todoToShow.status === 'in_progress' ? (
                      <Clock size={14} color={theme.colors.primary} />
                    ) : (
                      <Circle size={14} color={theme.colors.textSecondary} />
                    )}
                    <span
                      style={{
                        flex: 1,
                        color:
                          todoToShow.status === 'completed'
                            ? theme.colors.textSecondary
                            : theme.colors.text,
                        fontSize: '13px',
                        lineHeight: '1.5',
                      }}
                    >
                      {todoToShow.content}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor:
                          todoToShow.status === 'completed'
                            ? theme.colors.success + '20'
                            : todoToShow.status === 'in_progress'
                              ? theme.colors.primary + '20'
                              : theme.colors.textSecondary + '20',
                      }}
                    >
                      {todoToShow.status}
                    </span>
                  </>
                ) : (
                  // Show last event information
                  <>
                    <Sparkles size={14} color={sessionColor} />
                    <span
                      style={{
                        flex: 1,
                        color: theme.colors.text,
                        fontSize: '13px',
                        lineHeight: '1.5',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {cardData.latestEvent ? (
                        <>
                          <span
                            style={{ color: sessionColor, fontWeight: 500 }}
                          >
                            {cardData.latestEvent.toolName}
                          </span>
                          {cardData.latestEvent.fileName && (
                            <>
                              <span
                                style={{ color: theme.colors.textSecondary }}
                              >
                                →
                              </span>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '12px',
                                  color: theme.colors.textSecondary,
                                }}
                              >
                                {cardData.latestEvent.fileName}
                              </span>
                            </>
                          )}
                        </>
                      ) : (
                        <span
                          style={{
                            color: theme.colors.textSecondary,
                            fontStyle: 'italic',
                          }}
                        >
                          No events yet
                        </span>
                      )}
                    </span>
                    {cardData.latestEvent && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: theme.colors.textSecondary,
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor: theme.colors.backgroundTertiary,
                        }}
                      >
                        {new Date(
                          cardData.latestEvent.timestamp,
                        ).toLocaleTimeString()}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Expanded Todo List - Only show if there are todos */}
              {isTaskExpanded &&
                hasTodos &&
                cardData.lastTodos &&
                (() => {
                  // Show all todos in order: in_progress first, then pending, then completed
                  const orderedTodos = [
                    ...cardData.lastTodos.filter(
                      (t) => t.status === 'in_progress',
                    ),
                    ...cardData.lastTodos.filter((t) => t.status === 'pending'),
                    ...cardData.lastTodos.filter(
                      (t) => t.status === 'completed',
                    ),
                  ];

                  return (
                    <>
                      <div
                        style={{
                          marginTop: '12px',
                          fontSize: '11px',
                          color: theme.colors.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '8px',
                        }}
                      >
                        All Tasks ({orderedTodos.length})
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {orderedTodos.map((todo, index) => (
                          <div
                            key={todo.id || index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 12px',
                              backgroundColor: theme.colors.background,
                              borderRadius: '6px',
                              border: `1px solid ${theme.colors.border}`,
                              fontSize: '12px',
                            }}
                          >
                            {todo.status === 'completed' ? (
                              <Check size={12} color={theme.colors.success} />
                            ) : todo.status === 'in_progress' ? (
                              <Clock size={12} color={theme.colors.primary} />
                            ) : (
                              <Circle
                                size={12}
                                color={theme.colors.textSecondary}
                              />
                            )}
                            <span
                              style={{
                                flex: 1,
                                color:
                                  todo.status === 'completed'
                                    ? theme.colors.textSecondary
                                    : theme.colors.text,
                                fontSize: '12px',
                                lineHeight: '1.4',
                              }}
                            >
                              {todo.content}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                color: theme.colors.textSecondary,
                                textTransform: 'uppercase',
                                letterSpacing: '0.3px',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                backgroundColor:
                                  todo.status === 'completed'
                                    ? theme.colors.success + '20'
                                    : todo.status === 'in_progress'
                                      ? theme.colors.primary + '20'
                                      : theme.colors.textSecondary + '20',
                              }}
                            >
                              {todo.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
            </div>
          );
        })()}

        {/* Card Header - Show when details is toggled */}
        {showDetails && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: theme.colors.background,
              borderBottom: `1px solid ${theme.colors.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Session Icon */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: sessionColor + '20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <Activity size={18} color={sessionColor} />
                {cardData.session.status !== 'stopped' &&
                  cardData.session.status !== 'inactive' && (
                    <div
                      className={
                        cardData.activityType
                          ? `activity-dot ${cardData.activityType}`
                          : ''
                      }
                      style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '3px',
                        backgroundColor: cardData.session.statusColor,
                        boxShadow: cardData.activityType
                          ? `0 0 8px ${cardData.session.statusColor}80`
                          : 'none',
                        animation: !cardData.activityType ? 'none' : undefined,
                      }}
                    />
                  )}
              </div>

              {/* Session Info */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '2px',
                  }}
                >
                  {isEditingName ? (
                    <>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onSaveEditName();
                          } else if (e.key === 'Escape') {
                            onCancelEditName();
                          }
                        }}
                        onBlur={onSaveEditName}
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: theme.colors.text,
                          backgroundColor: theme.colors.backgroundSecondary,
                          border: `1px solid ${theme.colors.primary}`,
                          borderRadius: '4px',
                          padding: '4px 8px',
                          outline: 'none',
                          minWidth: '200px',
                        }}
                      />
                      <button
                        onClick={onSaveEditName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#10b981',
                          cursor: 'pointer',
                        }}
                        title="Save"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={onCancelEditName}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                        }}
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: theme.colors.text,
                        }}
                      >
                        {cardData.session.customName ||
                          `Session ${cardData.session.sessionId.substring(0, 8)}`}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartEditName();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: theme.colors.textSecondary,
                          cursor: 'pointer',
                          transition: 'color 0.2s',
                        }}
                        title="Edit name"
                      >
                        <Edit2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.colors.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <FolderOpen size={12} />
                  {cardData.session.workingDirectory?.split('/').pop() ||
                    'Unknown'}
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      color: theme.colors.textTertiary,
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                    }}
                    onClick={onCopySessionId}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = theme.colors.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = theme.colors.textTertiary)
                    }
                    title="Click to copy session ID"
                  >
                    {cardData.session.sessionId.substring(0, 8)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopySessionId();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: isCopied ? '#10b981' : theme.colors.textTertiary,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title={isCopied ? 'Copied!' : 'Copy full ID'}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: theme.colors.textTertiary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '2px',
                  }}
                >
                  {/* Status Badge */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      backgroundColor: cardData.session.statusColor + '20',
                      color: cardData.session.statusColor,
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    <div
                      style={{
                        width: '5px',
                        height: '5px',
                        borderRadius: '2px',
                        backgroundColor: cardData.session.statusColor,
                      }}
                    />
                    {cardData.session.statusText}
                  </span>

                  {/* Research Only Indicator */}
                  {(() => {
                    const hasWriteOps =
                      cardData.fileOperations &&
                      Array.from(cardData.fileOperations.values()).some((f) =>
                        f.operations.some(
                          (op) => op.type === 'write' || op.type === 'edit',
                        ),
                      );
                    const hasReadOps =
                      cardData.fileOperations &&
                      Array.from(cardData.fileOperations.values()).some((f) =>
                        f.operations.some((op) => op.type === 'read'),
                      );

                    if (!hasWriteOps && hasReadOps) {
                      return (
                        <>
                          <span style={{ opacity: 0.5 }}>•</span>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: theme.colors.primary + '20',
                              color: theme.colors.primary,
                              fontSize: '10px',
                              fontWeight: 600,
                            }}
                          >
                            <Search size={8} />
                            Research Only
                          </span>
                        </>
                      );
                    }
                    return null;
                  })()}
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span title="Last activity">
                    <Clock
                      size={10}
                      style={{ display: 'inline', marginRight: '2px' }}
                    />
                    {getTimeAgo(cardData.session.lastActivity || Date.now())}
                  </span>
                  <span style={{ opacity: 0.5 }}>•</span>
                  <span
                    className={
                      cardData.eventCountUpdated ? 'event-count-updated' : ''
                    }
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      transition: 'all 0.3s',
                    }}
                    title="Total events"
                  >
                    {cardData.session.eventCount || 0} events
                  </span>
                </div>

                {/* Latest Event Info */}
                {cardData.latestEvent && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.colors.textTertiary,
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Sparkles size={10} color={sessionColor} />
                    <span style={{ color: sessionColor, fontWeight: 500 }}>
                      {cardData.latestEvent.toolName}
                    </span>
                    {cardData.latestEvent.fileName && (
                      <>
                        <span style={{ opacity: 0.5 }}>→</span>
                        <span
                          style={{ fontFamily: 'monospace', fontSize: '10px' }}
                        >
                          {cardData.latestEvent.fileName}
                        </span>
                      </>
                    )}
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span>
                      {new Date(
                        cardData.latestEvent.timestamp,
                      ).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action Buttons - Where Resume/Archive used to be */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
              }}
            >
              {/* Event Carousel Toggle Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCarousel(!showCarousel);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  backgroundColor: showCarousel
                    ? theme.colors.primary + '20'
                    : 'transparent',
                  border: `1px solid ${showCarousel ? theme.colors.primary : theme.colors.border}`,
                  borderRadius: '4px',
                  color: showCarousel
                    ? theme.colors.primary
                    : theme.colors.text,
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: showCarousel ? 600 : 400,
                }}
                title={
                  showCarousel ? 'Hide event playback' : 'Show event playback'
                }
              >
                <PlayCircle size={12} />
                Playback
              </button>

              {/* Show on Map Button */}
              {onToggleShowOnMap && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleShowOnMap();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 8px',
                    backgroundColor: isShownOnMap
                      ? theme.colors.primary + '20'
                      : 'transparent',
                    border: `1px solid ${isShownOnMap ? theme.colors.primary : theme.colors.border}`,
                    borderRadius: '4px',
                    color: isShownOnMap
                      ? theme.colors.primary
                      : theme.colors.text,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: isShownOnMap ? 600 : 400,
                  }}
                  title={isShownOnMap ? 'Hide from map' : 'Show files on map'}
                >
                  <Map size={12} />
                  Map
                </button>
              )}
            </div>
          </div>
        )}

        {/* Card Content - Always show if there are file operations or carousel */}
        {((cardData.fileOperations && cardData.fileOperations.size > 0) ||
          showCarousel) && (
          <div
            style={{
              padding: '16px',
              backgroundColor: theme.colors.backgroundSecondary,
            }}
          >
            {/* Simple Stats Summary - Show if there are any file operations */}
            {cardData.fileOperations && cardData.fileOperations.size > 0 && (
              <div
                style={{
                  marginBottom: showCarousel ? '16px' : 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '8px 12px',
                    backgroundColor: theme.colors.background,
                    borderRadius: '6px',
                    border: `1px solid ${theme.colors.border}`,
                  }}
                >
                  {(cardData.session.fileAccessCount ?? 0) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      <BookOpen size={14} />
                      <span>{cardData.session.fileAccessCount ?? 0} read</span>
                    </div>
                  )}
                  {(cardData.session.fileWriteCount ?? 0) > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: theme.colors.textSecondary,
                      }}
                    >
                      <Edit3 size={14} />
                      <span>
                        {cardData.session.fileWriteCount ?? 0} modified
                      </span>
                    </div>
                  )}
                  {/* Show click hint if detail select is available */}
                  {onSessionDetailSelect && (
                    <div
                      style={{
                        marginLeft: 'auto',
                        fontSize: '11px',
                        color: theme.colors.textTertiary,
                        fontStyle: 'italic',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Click header for details →
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Event Carousel */}
            {showCarousel && (
              <div
                style={{
                  borderTop:
                    cardData.fileOperations && cardData.fileOperations.size > 0
                      ? `1px solid ${theme.colors.border}`
                      : 'none',
                  paddingTop:
                    cardData.fileOperations && cardData.fileOperations.size > 0
                      ? '12px'
                      : 0,
                  paddingBottom: '12px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                }}
              >
                {loadingEvents ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: theme.colors.textSecondary,
                      fontSize: '12px',
                    }}
                  >
                    Loading events...
                  </div>
                ) : events.length > 0 ? (
                  <EventCarousel
                    events={events}
                    onEventSelect={handleEventSelect}
                    onHighlightModeChange={handleHighlightModeChange}
                  />
                ) : (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: theme.colors.textSecondary,
                      fontSize: '12px',
                    }}
                  >
                    No events found for this session
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
