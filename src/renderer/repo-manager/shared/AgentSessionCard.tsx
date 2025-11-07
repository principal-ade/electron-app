import React, { useRef, useState } from 'react';
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
  ChevronDown,
  ChevronUp,
  FolderOpen,
  X,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  FileOperation,
  TodoItem,
} from '../../main-process-api/AgentSessionService';
import type { EnhancedUIAgentSessionData } from '../../types/session.types';
import type { TouchedProject } from '../../utils/sessionProjectMapping';

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
  onDeleteSession?: () => void;
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
  onDeleteSession,
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
  // Current task expanded state
  const [isTaskExpanded, setIsTaskExpanded] = useState(false);
  // Details (header) visibility state
  const [showDetails, setShowDetails] = useState(false);
  // Terminal loading state
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  return (
    <>
      <style>{shimmerStyle}</style>
      <div
        style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
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
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {hasTodos ? 'Current Task' : 'Last Event'}
                  </div>
                  {/* Relative Time */}
                  <span
                    style={{
                      fontSize: theme.fontSizes[1],
                      color: theme.colors.textTertiary,
                    }}
                  >
                    {getTimeAgo(cardData.session.lastActivity || Date.now())}
                  </span>
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
                        fontSize: theme.fontSizes[2],
                        lineHeight: '1.5',
                      }}
                    >
                      {todoToShow.content}
                    </span>
                    {todoToShow.status !== 'completed' && (
                      <span
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor:
                            todoToShow.status === 'in_progress'
                              ? theme.colors.primary + '20'
                              : theme.colors.textSecondary + '20',
                        }}
                      >
                        {todoToShow.status}
                      </span>
                    )}
                  </>
                ) : (
                  // Show last event information
                  <>
                    <Sparkles size={14} color={sessionColor} />
                    <span
                      style={{
                        flex: 1,
                        color: theme.colors.text,
                        fontSize: theme.fontSizes[2],
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
                                  fontFamily: theme.fonts.monospace,
                                  fontSize: theme.fontSizes[1],
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
                          fontSize: theme.fontSizes[1],
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
                          fontSize: theme.fontSizes[1],
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
                                fontSize: theme.fontSizes[1],
                                lineHeight: '1.4',
                              }}
                            >
                              {todo.content}
                            </span>
                            {todo.status !== 'completed' && (
                              <span
                                style={{
                                  fontSize: theme.fontSizes[1],
                                  color: theme.colors.textSecondary,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.3px',
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  backgroundColor:
                                    todo.status === 'in_progress'
                                      ? theme.colors.primary + '20'
                                      : theme.colors.textSecondary + '20',
                                }}
                              >
                                {todo.status}
                              </span>
                            )}
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
                          fontSize: theme.fontSizes[2],
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
                          fontSize: theme.fontSizes[2],
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
                    fontSize: theme.fontSizes[1],
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
                      fontFamily: theme.fonts.monospace,
                      fontSize: theme.fontSizes[0],
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
                    fontSize: theme.fontSizes[1],
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
                      fontSize: theme.fontSizes[1],
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
                              fontSize: theme.fontSizes[1],
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
                      fontSize: theme.fontSizes[1],
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
                          style={{ fontFamily: theme.fonts.monospace, fontSize: theme.fontSizes[0] }}
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
                    fontSize: theme.fontSizes[1],
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

        {/* Card Content - show if there are any stats to display */}
        {(() => {
          const hasTodos = cardData.lastTodos && cardData.lastTodos.length > 0;
          const hasStats =
            (cardData.session.fileAccessCount ?? 0) > 0 ||
            (cardData.session.fileWriteCount ?? 0) > 0 ||
            (cardData.session.toolCallCount ?? 0) > 0;
          const showLastEvent = hasTodos && cardData.latestEvent;

          return (
            (hasStats || showLastEvent) && (
              <div
                style={{
                  padding: '16px',
                  backgroundColor: theme.colors.backgroundSecondary,
                }}
              >
                {/* Last Event - Only show for sessions with todos */}
                {showLastEvent && (
                  <div
                    style={{
                      marginBottom: hasStats ? '12px' : '0',
                    }}
                  >
                    <div
                      style={{
                        fontSize: theme.fontSizes[1],
                        color: theme.colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                      }}
                    >
                      Last Event
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        backgroundColor: theme.colors.background,
                        borderRadius: '6px',
                        border: `1px solid ${theme.colors.border}`,
                      }}
                    >
                      <Sparkles size={14} color={sessionColor} />
                      <span
                        style={{
                          flex: 1,
                          color: theme.colors.text,
                          fontSize: theme.fontSizes[2],
                          lineHeight: '1.5',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ color: sessionColor, fontWeight: 500 }}>
                          {cardData.latestEvent?.toolName}
                        </span>
                        {cardData.latestEvent?.fileName && (
                          <>
                            <span style={{ color: theme.colors.textSecondary }}>
                              →
                            </span>
                            <span
                              style={{
                                fontFamily: theme.fonts.monospace,
                                fontSize: theme.fontSizes[1],
                                color: theme.colors.textSecondary,
                              }}
                            >
                              {cardData.latestEvent.fileName}
                            </span>
                          </>
                        )}
                      </span>
                      <span
                        style={{
                          fontSize: theme.fontSizes[1],
                          color: theme.colors.textSecondary,
                          padding: '2px 6px',
                          borderRadius: '3px',
                          backgroundColor: theme.colors.backgroundTertiary,
                        }}
                      >
                        {cardData.latestEvent?.timestamp &&
                          new Date(
                            cardData.latestEvent.timestamp,
                          ).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Simple Stats Summary */}
                {hasStats && (
                  <div>
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
                            gap: '6px',
                          }}
                        >
                          <Activity size={12} color={sessionColor} />
                          <span style={{ fontSize: theme.fontSizes[1] }}>
                            {cardData.session.fileAccessCount} file reads
                          </span>
                        </div>
                      )}
                      {(cardData.session.fileWriteCount ?? 0) > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Edit3 size={12} color={sessionColor} />
                          <span style={{ fontSize: theme.fontSizes[1] }}>
                            {cardData.session.fileWriteCount} file writes
                          </span>
                        </div>
                      )}
                      {(cardData.session.toolCallCount ?? 0) > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <Sparkles size={12} color={sessionColor} />
                          <span style={{ fontSize: theme.fontSizes[1] }}>
                            {cardData.session.toolCallCount} tool calls
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          );
        })()}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '0',
            borderTop: `1px solid ${theme.colors.border}`,
          }}
        >
          {/* Resume Button */}
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
                flex: 1,
                background: 'none',
                border: 'none',
                padding: '8px',
                cursor: isTerminalLoading ? 'wait' : 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                borderRight: `1px solid ${theme.colors.border}`,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                if (!isTerminalLoading) {
                  e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                  e.currentTarget.style.color = theme.colors.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (!isTerminalLoading) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textSecondary;
                }
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
          {/* Details Button */}
          {onSessionDetailSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('[AgentSessionCard] Details button clicked');
                onSessionDetailSelect();
              }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
                borderRight: `1px solid ${theme.colors.border}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.colors.primary}15`;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              title="Open detail view"
            >
              <span>Details</span>
            </button>
          )}
          {/* Delete Button */}
          {onDeleteSession && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  confirm(
                    'Are you sure you want to delete this session? This cannot be undone.',
                  )
                ) {
                  onDeleteSession();
                }
              }}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                padding: '8px',
                cursor: 'pointer',
                color: theme.colors.textSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                fontSize: theme.fontSizes[1],
                fontFamily: theme.fonts.body,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${theme.colors.error}15`;
                e.currentTarget.style.color = theme.colors.error || '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textSecondary;
              }}
              title="Delete session"
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
