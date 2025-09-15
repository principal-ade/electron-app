import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTheme } from 'themed-markdown';
import type { HighlightLayer } from "@principal-ai/code-city-react";
import { 
  Layers,
  Package,
  Bot,
  Play
} from 'lucide-react';
import { AgentSessionService, FileOperation, TodoItem } from '../../../main-process-api/AgentSessionService';
import { AgentSessionArchiveService } from '../../../main-process-api/AgentSessionArchiveService';
import { ShellService } from '../../../main-process-api/ShellService';
import { useFileChanges, SessionFileActivity } from '../../../contexts/FileChangeContext';
import { EnhancedUIAgentSessionData } from '../../../types/session.types';
import { TouchedProject, mapFileOperationsToProjects } from '../../../utils/sessionProjectMapping';
import { PackageLayer, PackageCommand } from "@principal-ai/codebase-composition";
import { FileTreeSourceService } from '../../../services/FileTreeSourceService';
import { PackageCommandPanel } from '../../../components/repository-maps/PackageCommandPanel';
import { AgentSelectionModal } from '../../../components/repository-maps/AgentSelectionModal';
import { AgentSessionCard, SessionCardData } from './AgentSessionCard';
import { EventHistoryModal } from '../../../components/session-history/EventHistoryModal';
import type { Repository } from '../../../../shared/types/repository.types';
import { FileTreeSource } from '../../../types/file-tree-source';

interface AgentSessionsTabProps {
  repositoryPath: string;
  localClonePaths?: string[];
  selectedCloneAgentSessionIds?: Set<string>; // Only count and display sessions with these IDs
  selectedAgentSessionIds: Set<string>;
  onSessionSelect?: (sessionId: string) => void;
  onSessionUnselect?: (sessionId: string) => void;
  onLayersGenerated?: (sessionId: string, readLayer: HighlightLayer | null, writeLayer: HighlightLayer | null) => void;
  onOpenTerminal?: (sessionId: string, sessionName?: string) => void;
  onShowContext?: (sessionId: string) => void; // Show tribal knowledge context for session
  onSessionDetailSelect?: (sessionId: string, cardData: SessionCardData) => void; // Show session detail view
  onSessionMapVisibilityChange?: (sessionId: string | null) => void; // Called when session is shown/hidden on map
  allAgentSessions?: EnhancedUIAgentSessionData[]; // All available sessions for filtering
  fileTreeSourceService?: FileTreeSourceService; // For accessing file tree and package detection
  sourceId?: string; // Source ID for getting cached architecture analysis
  repository?: Repository; // Repository info for display
  fileTreeSources?: FileTreeSource[]; // Available sources for launching agents (renamed to avoid conflict)
  onSessionCardUpdate?: (sessionId: string, cardData: SessionCardData) => void; // Called when a session card is updated
}

// Loading state component with shimmer effect
const LoadingState: React.FC<{ theme: any }> = ({ theme }) => (
  <>
    <style>{`
      @keyframes shimmer {
        0% {
          background-position: -200% 0;
        }
        100% {
          background-position: 200% 0;
        }
      }
      
      .shimmer {
        background: linear-gradient(
          90deg,
          ${theme.colors.backgroundSecondary} 25%,
          ${theme.colors.backgroundTertiary} 50%,
          ${theme.colors.backgroundSecondary} 75%
        );
        background-size: 200% 100%;
        animation: shimmer 2s infinite;
      }
    `}</style>
    
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px'
    }}>
      {/* Shimmer cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          backgroundColor: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: '8px',
          overflow: 'hidden'
        }}>
          {/* Card header shimmer */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: theme.colors.background,
            borderBottom: `1px solid ${theme.colors.border}`
          }}>
            <div className="shimmer" style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px'
            }} />
            <div style={{ flex: 1 }}>
              <div className="shimmer" style={{
                height: '16px',
                width: '120px',
                borderRadius: '4px',
                marginBottom: '6px'
              }} />
              <div className="shimmer" style={{
                height: '12px',
                width: '200px',
                borderRadius: '4px'
              }} />
            </div>
          </div>
          
          {/* Card body shimmer */}
          <div style={{ padding: '12px 16px' }}>
            <div className="shimmer" style={{
              height: '14px',
              width: '100%',
              borderRadius: '4px',
              marginBottom: '8px'
            }} />
            <div className="shimmer" style={{
              height: '14px',
              width: '80%',
              borderRadius: '4px'
            }} />
          </div>
        </div>
      ))}
      
      <div style={{
        textAlign: 'center',
        color: theme.colors.textSecondary,
        fontSize: '13px',
        marginTop: '8px'
      }}>
        Loading agent sessions...
      </div>
    </div>
  </>
);

// Empty state component
const EmptyState: React.FC<{
  theme: any;
  selectedAgentSessionIds: Set<string>;
  fileTreeSources?: FileTreeSource[];
  onStartSession: () => void;
}> = ({ theme, selectedAgentSessionIds, fileTreeSources, onStartSession }) => {
  const hasLocalSources = fileTreeSources && fileTreeSources.filter(s => s.type === 'local').length > 0;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      color: theme.colors.textSecondary,
      textAlign: 'center',
      gap: '24px'
    }}>
      {/* Icon */}
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '16px',
        backgroundColor: theme.colors.backgroundTertiary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Bot size={32} color={theme.colors.textSecondary} />
      </div>
      
      {/* Message */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: theme.colors.text
        }}>
          No Active Sessions
        </div>
        <div style={{
          fontSize: '14px',
          fontWeight: 400
        }}>
          {selectedAgentSessionIds.size === 0 ? (
            <>Start a new agent session to begin working with AI assistance</>
          ) : (
            <>No sessions from your selection are currently displayed. Try selecting different sessions from the header.</>
          )}
        </div>
      </div>
      
      {/* Start Session Button */}
      {hasLocalSources && (
        <button
          onClick={onStartSession}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: theme.colors.primary,
            color: theme.colors.background,
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = theme.shadows[1] || '0 4px 12px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Play size={16} />
          Start New Session
        </button>
      )}
    </div>
  );
};


export const AgentSessionsTab: React.FC<AgentSessionsTabProps> = ({
  repositoryPath,
  localClonePaths = [],
  selectedCloneAgentSessionIds,
  selectedAgentSessionIds,
  allAgentSessions = [],
  onSessionSelect,
  onSessionUnselect,
  onLayersGenerated,
  onOpenTerminal,
  onShowContext,
  onSessionDetailSelect,
  onSessionMapVisibilityChange,
  fileTreeSourceService,
  sourceId,
  repository,
  fileTreeSources = [],
  onSessionCardUpdate,
}) => {
  const { theme } = useTheme();
  const { sources, registerSessionActivity } = useFileChanges();
  const [sessionCards, setSessionCards] = useState<Map<string, SessionCardData>>(new Map());
  const [loading, setLoading] = useState(true); // Start with loading true since we'll load immediately
  const [hasInitiallyLoaded, setHasInitiallyLoaded] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [archivingSessionId, setArchivingSessionId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null!);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [sessionShownOnMap, setSessionShownOnMap] = useState<string | null>(null); // Track which session is shown on map
  const previousSessionShownOnMapRef = useRef<string | null>(null); // Track previous session for cleanup
  
  // Event viewer modal state
  const [eventViewerSession, setEventViewerSession] = useState<{ id: string; name?: string } | null>(null);
  
  // Command panel state
  const [commandPanelOpen, setCommandPanelOpen] = useState(false);
  const [selectedPackageForCommands, setSelectedPackageForCommands] = useState<PackageLayer | null>(null);
  const [selectedProjectForCommands, setSelectedProjectForCommands] = useState<TouchedProject | null>(null);
  const [affectedSessionsCount, setAffectedSessionsCount] = useState(0);
  
  // Track locally archived sessions to exclude them from counts until parent updates
  const [locallyArchivedSessions, setLocallyArchivedSessions] = useState<Set<string>>(new Set());
  
  // Cache for session written files to avoid reloading events
  const [sessionWrittenFilesCache, setSessionWrittenFilesCache] = useState<Map<string, string[]>>(new Map());
  
  // Manual changes (files changed but not by any agent)
  const [manualChanges, setManualChanges] = useState<string[]>([]);
  
  // Get written files from session data (no event fetching needed)
  const loadSessionWrittenFiles = async (sessionId: string): Promise<string[]> => {
    // Check cache first
    const cached = sessionWrittenFilesCache.get(sessionId);
    if (cached) return cached;
    
    // Get written files from session data instead of fetching events
    const session = allAgentSessions.find(s => s.sessionId === sessionId);
    if (session?.fileWrites) {
      const writtenFiles = Object.keys(session.fileWrites);
      // Update cache
      setSessionWrittenFilesCache(prev => {
        const newCache = new Map(prev);
        newCache.set(sessionId, writtenFiles);
        return newCache;
      });
      return writtenFiles;
    }
    return [];
  };

  // Aggregate all touched packages across selected sessions
  const aggregatedPackages = useMemo(() => {
    const packageMap = new Map<string, {
      package: TouchedProject;
      sessionCount: number;
      totalFileCount: number;
      hasWrites: boolean;
    }>();

    // Iterate through all session cards to aggregate packages
    sessionCards.forEach((cardData) => {
      if (cardData.touchedProjects) {
        cardData.touchedProjects.forEach(project => {
          const key = project.path || project.name;
          const existing = packageMap.get(key);
          
          if (existing) {
            existing.sessionCount++;
            existing.totalFileCount += project.fileCount;
            existing.hasWrites = existing.hasWrites || project.hasWrites;
          } else {
            packageMap.set(key, {
              package: project,
              sessionCount: 1,
              totalFileCount: project.fileCount,
              hasWrites: project.hasWrites
            });
          }
        });
      }
    });

    // Convert to array and sort by session count (most touched first)
    return Array.from(packageMap.values())
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }, [sessionCards]);


  // Helper to format time ago
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
  };

  // Agent color palette
  const getAgentColor = (sessionId: string): string => {
    const colors = [
      '#F02C03',
      '#FF950C', 
      '#FEDC03',
      '#7CDA01',
      '#0D8DFF',
      '#B02FF7',
    ];

    const hash = sessionId.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hash) % colors.length];
  };

  // Watch for session updates and apply animations
  useEffect(() => {
    // When allAgentSessions updates (from real-time events), update cards
    allAgentSessions.forEach(session => {
      if (selectedAgentSessionIds.has(session.sessionId)) {
        setSessionCards(prev => {
          const newMap = new Map(prev);
          const existingCard = newMap.get(session.sessionId);
          
          if (existingCard) {
            // Check if event count changed
            const eventCountChanged = existingCard.session.eventCount !== session.eventCount;
            const now = Date.now();
            
            // Determine activity type
            let activityType: 'active' | 'waiting' | null = null;
            if (session.status === 'waiting') {
              activityType = 'waiting';
            } else if (eventCountChanged || session.lastActivity > (existingCard.session.lastActivity || 0)) {
              activityType = 'active';
            }
            
            // Update the card with new session data, preserving latestEvent
            newMap.set(session.sessionId, {
              ...existingCard,
              session: session,
              previousEventCount: existingCard.session.eventCount,
              eventCountUpdated: eventCountChanged,
              lastEventTimestamp: eventCountChanged ? now : existingCard.lastEventTimestamp,
              isRecentlyActive: true,
              activityType,
              latestEvent: existingCard.latestEvent // Preserve the latest event info
            });
            
            // Clear count animation flag after a delay
            if (eventCountChanged) {
              setTimeout(() => {
                setSessionCards(prev => {
                  const updated = new Map(prev);
                  const card = updated.get(session.sessionId);
                  if (card) {
                    updated.set(session.sessionId, {
                      ...card,
                      eventCountUpdated: false
                    });
                  }
                  return updated;
                });
              }, 500);
            }
          }
          
          return newMap;
        });
      }
    });
  }, [allAgentSessions, selectedAgentSessionIds]);
  
  // Timer to update activity indicators (hide after 30 seconds of inactivity)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setSessionCards(prev => {
        const updated = new Map(prev);
        let hasChanges = false;
        
        updated.forEach((card, sessionId) => {
          // Skip if waiting (always show indicator)
          if (card.session.status === 'waiting') {
            return;
          }
          
          const timeSinceLastEvent = now - (card.lastEventTimestamp || 0);
          const shouldBeActive = timeSinceLastEvent < 30000; // 30 seconds
          
          // Only update if status changed
          if (card.isRecentlyActive !== shouldBeActive) {
            hasChanges = true;
            updated.set(sessionId, {
              ...card,
              isRecentlyActive: shouldBeActive,
              activityType: shouldBeActive ? 'active' : null
            });
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Build session cards from allAgentSessions for selected IDs
  const loadSelectedSessions = useCallback(async (skipLoading = false) => {
    // Only show loading on initial load
    if (!skipLoading && !hasInitiallyLoaded) {
      setLoading(true);
    }
    
    try {
      const newCards = new Map<string, SessionCardData>();
    
    // Get git changes
    const gitSource = Array.from(sources.values()).find(source => 
      source.source.path === repositoryPath
    );
    const gitChanges = gitSource?.gitChanges;
    
    // Build a set of all files with uncommitted changes
    const filesWithGitChanges = new Set<string>();
    if (gitChanges) {
      gitChanges.created?.forEach(f => filesWithGitChanges.add(f));
      gitChanges.modified?.forEach(f => filesWithGitChanges.add(f));
      gitChanges.deleted?.forEach(f => filesWithGitChanges.add(f));
    }
    
    // Track which files were modified by which agents (for collision detection)
    // IMPORTANT: Check ALL sessions, not just selected ones, for accurate manual change detection
    const fileToAgents = new Map<string, Set<string>>();
    
    // Filter sessions to only include ones from the selected clone and exclude locally archived
    const filteredAgentSessions = selectedCloneAgentSessionIds 
      ? allAgentSessions.filter(session => 
          selectedCloneAgentSessionIds.has(session.sessionId) && !locallyArchivedSessions.has(session.sessionId)
        )
      : allAgentSessions.filter(session => !locallyArchivedSessions.has(session.sessionId));
    
    // First pass: Track ALL agent modifications for accurate manual change detection
    for (const session of filteredAgentSessions) {
      // Use session's fileWrites data instead of fetching events
      if (session.fileWrites) {
        const sessionWrittenFiles = Object.keys(session.fileWrites);
        
        // Track files for collision detection
        sessionWrittenFiles.forEach(file => {
          if (!fileToAgents.has(file)) {
            fileToAgents.set(file, new Set());
          }
          fileToAgents.get(file)!.add(session.sessionId);
        });
      }
    }
    
    // Don't wait for package layers - load them async only if available
    // This lets sessions load immediately without waiting for file tree
    let packageLayers: any = null;
    
    // Try to get package layers if service is available, but don't block on it
    if (fileTreeSourceService && sourceId) {
      fileTreeSourceService.detectPackagesForSource(sourceId)
        .then(layers => {
          packageLayers = layers;
          // If we got layers after cards were built, update touched projects
          setSessionCards(prev => {
            const updatedCards = new Map(prev);
            updatedCards.forEach((cardData, sessionId) => {
              if (cardData.fileOperations && layers && !cardData.touchedProjects) {
                cardData.touchedProjects = mapFileOperationsToProjects(
                  cardData.fileOperations, 
                  layers, 
                  repositoryPath
                );
              }
            });
            return updatedCards;
          });
        })
        .catch(err => {
          console.log('[AgentSessionsTab] Package detection not available yet, skipping touched projects');
        });
    }

    // Second pass: Build cards for selected sessions using existing session data
    for (const session of allAgentSessions) {
      if (selectedAgentSessionIds.has(session.sessionId)) {
        // Use data already in the session object instead of fetching events
        let fileOperations: Map<string, FileOperation> | undefined;
        let lastTodos: TodoItem[] | undefined;
        let touchedProjects: TouchedProject[] | undefined;
        let hasUncommittedChanges = false;
        
        // Build file operations from session's fileAccesses and fileWrites
        if (session.fileWrites || session.fileAccesses) {
          fileOperations = new Map();
          
          // Add write operations
          if (session.fileWrites) {
            Object.entries(session.fileWrites).forEach(([filePath, writes]) => {
              const ops = writes.map(w => ({
                type: 'write' as const,
                timestamp: w.timestamp,
                tool: typeof w.operation === 'string' ? w.operation : 'Edit'
              }));
              fileOperations!.set(filePath, {
                path: filePath,
                relativePath: filePath,
                operations: ops,
                lastModified: Math.max(...ops.map(o => o.timestamp))
              });
            });
          }
          
          // Add read operations
          if (session.fileAccesses) {
            Object.entries(session.fileAccesses).forEach(([filePath, accesses]) => {
              const existing = fileOperations!.get(filePath);
              const readOps = accesses.map(a => ({
                type: 'read' as const,
                timestamp: a.timestamp,
                tool: 'Read'
              }));
              
              if (existing) {
                existing.operations.push(...readOps);
                existing.operations.sort((a, b) => a.timestamp - b.timestamp);
                existing.lastModified = Math.max(existing.lastModified, ...readOps.map(o => o.timestamp));
              } else {
                fileOperations!.set(filePath, {
                  path: filePath,
                  relativePath: filePath,
                  operations: readOps,
                  lastModified: Math.max(...readOps.map(o => o.timestamp))
                });
              }
            });
          }
          
          // Register file activities with FileChangeContext if we have a sourceId
          if (fileOperations && sourceId && registerSessionActivity) {
            fileOperations.forEach((fileOp, filePath) => {
              const activity = {
                sessionId: session.sessionId,
                agentType: session.metadata?.provider || 'unknown',
                agentName: session.customName || session.sessionId.substring(0, 8),
                filePath: fileOp.relativePath || filePath,
                operations: fileOp.operations,
                lastModified: fileOp.lastModified,
                isActive: false // Will be updated when session is selected
              };
              registerSessionActivity(sourceId, activity);
            });
            console.log(`[AgentSessionsTabNew] Registered ${fileOperations.size} file activities for session ${session.sessionId}`);
          }
        }
        
        // TODO: Extract last todos from session.metadata or lastEvent when available
        // For now, todos will only be loaded when detail view is opened
        lastTodos = session.metadata?.lastTodos;
        
        // Check if session has uncommitted changes
        const sessionWrittenFiles = session.fileWrites ? Object.keys(session.fileWrites) : [];
        hasUncommittedChanges = sessionWrittenFiles.some(file => 
          filesWithGitChanges.has(file)
        );
        
        const now = Date.now();
        const timeSinceLastActivity = now - (session.lastActivity || now);
        const isRecentlyActive = timeSinceLastActivity < 30000; // 30 seconds
        
        newCards.set(session.sessionId, {
          session: session,
          isExpanded: true,
          hasUncommittedChanges,
          fileOperations,
          lastTodos,
          touchedProjects, // Will be undefined initially, updated async
          lastEventTimestamp: session.lastActivity || now,
          isRecentlyActive,
          activityType: session.status === 'waiting' 
            ? 'waiting' 
            : isRecentlyActive 
              ? 'active' 
              : null,
          stats: {
            filesRead: session.fileAccessCount || 0,
            filesWritten: session.fileWriteCount || 0,
            toolCalls: session.toolCallCount || 0,
            lastActivity: new Date(session.lastActivity || Date.now())
          }
        });
      }
    }
    
    // Identify files with collisions (modified by multiple agents)
    const filesWithCollisions = new Set<string>();
    fileToAgents.forEach((agents, file) => {
      if (agents.size > 1) {
        filesWithCollisions.add(file);
      }
    });
    
    // Identify manual changes (git changes not claimed by any agent)
    const manualChanges = Array.from(filesWithGitChanges).filter(file => 
      !fileToAgents.has(file)
    );
    
    // Store collision info in each card
    newCards.forEach((cardData, sessionId) => {
      if (cardData.fileOperations) {
        cardData.fileOperations.forEach((fileOp, filePath) => {
          const fileKey = fileOp.relativePath || filePath;
          if (filesWithCollisions.has(fileKey)) {
            // Add collision info to the file operation
            (fileOp as any).hasCollision = true;
            (fileOp as any).agentCount = fileToAgents.get(fileKey)?.size || 0;
          }
        });
      }
    });
    
    // Store manual changes for display
    setSessionCards(newCards);
    setManualChanges(manualChanges);
    } finally {
      // Only set loading false if we set it to true, and mark as initially loaded
      if (!skipLoading && !hasInitiallyLoaded) {
        setLoading(false);
        setHasInitiallyLoaded(true);
      }
    }
  }, [selectedAgentSessionIds, allAgentSessions, sources, repositoryPath, locallyArchivedSessions, fileTreeSourceService, sourceId, registerSessionActivity]); // Removed hasInitiallyLoaded from deps
  
  // Generate highlight layers for sessions
  // IMPORTANT: Only generate layers for ONE session at a time for the demo
  // This allows users to click to follow a specific session on the map
  useEffect(() => {
    if (!onLayersGenerated) {
      return;
    }
    
    // Clear the previously shown session's layers if it changed
    if (previousSessionShownOnMapRef.current && previousSessionShownOnMapRef.current !== sessionShownOnMap) {
      onLayersGenerated(previousSessionShownOnMapRef.current, null, null);
    }
    
    // Update the ref for next time
    previousSessionShownOnMapRef.current = sessionShownOnMap;
    
    // Only generate layers for the session shown on map
    if (sessionShownOnMap) {
      const cardData = sessionCards.get(sessionShownOnMap);
      
      
      if (cardData && cardData.fileOperations) {
        const sessionIdToShow = sessionShownOnMap;
        const sessionColor = getAgentColor(sessionIdToShow);
        const sessionName = cardData.session.customName || `Session ${sessionIdToShow.substring(0, 8)}`;
        
        // Separate files into reads and writes
        const readFiles: string[] = [];
        const writeFiles: string[] = [];
        
        cardData.fileOperations.forEach((fileOp) => {
          const hasWrite = fileOp.operations.some(op => op.type === 'write' || op.type === 'edit');
          const hasRead = fileOp.operations.some(op => op.type === 'read');
          
          // Use relative path for the map visualization
          let filePath = fileOp.relativePath || fileOp.path;
          
          // Strip repository path if the path is absolute
          if (filePath.startsWith('/') && repositoryPath && filePath.startsWith(repositoryPath)) {
            filePath = filePath.substring(repositoryPath.length);
            // Remove leading slash
            if (filePath.startsWith('/')) {
              filePath = filePath.substring(1);
            }
          }
          
          
          if (hasWrite) {
            writeFiles.push(filePath);
          } else if (hasRead) {
            readFiles.push(filePath);
          }
        });
        
        
        // Create write layer (filled)
        const writeLayer: HighlightLayer | null = writeFiles.length > 0 ? {
          id: `session-${sessionIdToShow}-write`,
          name: `${sessionName} - Writes`,
          enabled: true,
          color: sessionColor,
          priority: 20, // Higher priority for writes
          opacity: 0.3, // Semi-transparent fill
          items: writeFiles.map(path => ({
            path,
            type: 'file' as const,
            renderStrategy: 'fill' as const
          }))
        } : null;
        
        // Create read layer (border only)
        const readLayer: HighlightLayer | null = readFiles.length > 0 ? {
          id: `session-${sessionIdToShow}-read`,
          name: `${sessionName} - Reads`,
          enabled: true,
          color: sessionColor,
          priority: 15, // Lower priority than writes
          borderWidth: 2,
          items: readFiles.map(path => ({
            path,
            type: 'file' as const,
            renderStrategy: 'border' as const
          }))
        } : null;
        
        
        // Send layers to parent
        onLayersGenerated(sessionIdToShow, readLayer, writeLayer);
      }
    }
    
    
    // Cleanup function to clear layers when component unmounts
    return () => {
      if (sessionShownOnMap && onLayersGenerated) {
        onLayersGenerated(sessionShownOnMap, null, null);
      }
    };
  }, [sessionCards, sessionShownOnMap, onLayersGenerated, repositoryPath]);

  // Auto-select all sessions if none are selected
  useEffect(() => {
    if (allAgentSessions.length > 0 && selectedAgentSessionIds.size === 0 && onSessionSelect) {
      console.log('[AgentSessionsTab] Auto-selecting all sessions since none are selected');
      allAgentSessions.forEach(session => {
        onSessionSelect(session.sessionId);
      });
    }
  }, [allAgentSessions, selectedAgentSessionIds, onSessionSelect]);

  // Load sessions when selection changes or component mounts
  useEffect(() => {
    // Load sessions immediately when component mounts or selection changes
    // Skip loading state after initial load to avoid flicker
    loadSelectedSessions(hasInitiallyLoaded);
  }, [selectedAgentSessionIds, allAgentSessions, locallyArchivedSessions]); // Remove loadSelectedSessions from deps to avoid infinite loop
  
  // Clear locally archived sessions when allAgentSessions updates (parent has refreshed)
  useEffect(() => {
    // Remove any locally archived sessions that are no longer in allAgentSessions
    // or are now marked as archived in the parent data
    setLocallyArchivedSessions(prev => {
      const updated = new Set<string>();
      prev.forEach(sessionId => {
        const session = allAgentSessions.find(s => s.sessionId === sessionId);
        // Keep in locally archived if session still exists and is still active
        // (meaning parent hasn't updated yet)
        if (session && session.isActive && !session.archivedAt) {
          updated.add(sessionId);
        }
      });
      return updated;
    });
  }, [allAgentSessions]);
  
  
  // Listen for session updates
  useEffect(() => {
    const unsubscribe = AgentSessionService.onSessionUpdated(async (data) => {
      
      // Check if this session is in our displayed cards (use function to get current state)
      setSessionCards(currentCards => {
        if (!data.sessionId || !currentCards.has(data.sessionId)) {
          return currentCards;
        }
        return currentCards; // Return unchanged for now, we'll update async below
      });
      
      // The session data will be updated through the normal props flow
      // No need to fetch events here - the parent component handles updates
      
      // Only reload sessions if this was a stop event or status change that might affect filters
      // Don't reload for regular activity events which are already handled above
      if ('eventType' in data && (data.eventType === 'stop' || data.eventType === 'session_ended')) {
        // Trigger a reload of sessions to update counts and remove stopped sessions
        // Skip loading state since this is an incremental update
        loadSelectedSessions(true);
      }
    });
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [sourceId, registerSessionActivity, loadSelectedSessions]);

  // Archive session
  const archiveSession = async (sessionId: string) => {
    const cardData = sessionCards.get(sessionId);
    if (!cardData) return;
    
    setArchivingSessionId(sessionId);
    try {
      await AgentSessionArchiveService.archiveSession(sessionId);
      
      // Mark as locally archived immediately to update counts
      setLocallyArchivedSessions(prev => new Set([...prev, sessionId]));
      
      // Remove from selected sessions after archiving
      onSessionUnselect?.(sessionId);
      
      // Reload sessions to update UI (skip loading state)
      await loadSelectedSessions(true);
    } catch (error) {
      console.error('Failed to archive session:', error);
      // Remove from locally archived on error
      setLocallyArchivedSessions(prev => {
        const updated = new Set(prev);
        updated.delete(sessionId);
        return updated;
      });
    } finally {
      setArchivingSessionId(null);
    }
  };

  // Start editing session name
  const startEditingSessionName = (sessionId: string, currentName?: string) => {
    setEditingSessionId(sessionId);
    setEditingName(currentName || `Session ${sessionId.substring(0, 8)}`);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 50);
  };

  // Save session name
  const saveSessionName = async () => {
    if (!editingSessionId) return;
    
    const trimmedName = editingName.trim();
    const cardData = sessionCards.get(editingSessionId);
    
    if (trimmedName && cardData) {
      const success = await AgentSessionService.updateSessionMetadata(
        editingSessionId,
        cardData.session.workingDirectory,
        { customName: trimmedName }
      );
      
      if (success) {
        // Update the local state
        setSessionCards(prev => {
          const newMap = new Map(prev);
          const data = newMap.get(editingSessionId);
          if (data) {
            data.session.customName = trimmedName;
            if (!data.session.metadata) {
              data.session.metadata = {};
            }
            data.session.metadata.customName = trimmedName;
          }
          return newMap;
        });
      }
    }
    
    setEditingSessionId(null);
    setEditingName('');
  };

  // Cancel editing session name
  const cancelEditingSessionName = () => {
    setEditingSessionId(null);
    setEditingName('');
  };

  // Handle running a package command
  const handleRunPackageCommand = async (command: PackageCommand): Promise<void> => {
    if (!command.workingDirectory) {
      throw new Error('No working directory specified for command');
    }

    // Build the full working directory path
    const fullWorkingDir = command.workingDirectory.startsWith('/') 
      ? command.workingDirectory 
      : `${repositoryPath}/${command.workingDirectory}`;

    // Get user's preferred terminal or use default
    try {
      const { UserPreferencesService } = await import('../../../main-process-api/UserPreferencesService');
      const { DEFAULT_TERMINAL } = await import('../../../../shared/types/terminal.types');
      
      const preferences = await UserPreferencesService.getPreferences();
      const preferredTerminal = preferences.defaultTerminal || DEFAULT_TERMINAL;

      // Open terminal and run command so user can see output
      const result = await ShellService.openInTerminal({
        terminal: preferredTerminal,
        dir: fullWorkingDir,
        command: command.command
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to open terminal');
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  };

  // Copy session ID to clipboard
  const copySessionIdToClipboard = (sessionId: string) => {
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopiedSessionId(sessionId);
      setTimeout(() => {
        setCopiedSessionId(null);
      }, 2000);
    });
  };

  // Get sessions to display based on selected IDs
  const displayedSessions = Array.from(sessionCards.values()).filter(cardData => {
    return selectedAgentSessionIds.has(cardData.session.sessionId);
  });

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes breathe {
          0%, 100% { 
            opacity: 0.3; 
            transform: scale(0.8); 
          }
          50% { 
            opacity: 0.8; 
            transform: scale(1.2); 
          }
        }
        
        @keyframes breatheWaiting {
          0%, 100% { 
            opacity: 0.4; 
            transform: scale(0.9); 
          }
          50% { 
            opacity: 1; 
            transform: scale(1.3); 
          }
        }
        
        @keyframes countPulse {
          0% {
            transform: scale(1);
            background-color: rgba(16, 185, 129, 0.05);
          }
          50% {
            transform: scale(1.08);
            background-color: rgba(16, 185, 129, 0.15);
          }
          100% {
            transform: scale(1);
            background-color: rgba(16, 185, 129, 0.05);
          }
        }
        
        .event-count-updated {
          animation: countPulse 1.2s ease-in-out;
        }
        
        .activity-dot.active {
          animation: breathe 4s ease-in-out infinite !important;
        }
        
        .activity-dot.waiting {
          animation: breatheWaiting 3s ease-in-out infinite !important;
        }
      `}</style>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        minHeight: 0 // Important for flexbox children
      }}>
      
      {/* Session List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: (loading && displayedSessions.length === 0) ? '0' : '12px', // Remove padding when loading for better shimmer effect
        minHeight: 0 // Important for flex children to scroll properly
      }}>
        {(loading && displayedSessions.length === 0) ? (
          // Show loading state only when we have no sessions yet
          <LoadingState theme={theme} />
        ) : (displayedSessions.length === 0) ? (
          // Show empty state when no sessions after loading
          <EmptyState 
            theme={theme}
            selectedAgentSessionIds={selectedAgentSessionIds}
            fileTreeSources={fileTreeSources}
            onStartSession={() => setIsAgentModalOpen(true)}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {/* Agent Session Cards */}
            {displayedSessions.map((cardData) => {
              const sessionColor = getAgentColor(cardData.session.sessionId);
              
              return (
                <AgentSessionCard
                  key={cardData.session.sessionId}
                  cardData={cardData}
                  sessionColor={sessionColor}
                  theme={theme}
                  sources={sources}
                  repositoryPath={repositoryPath}
                  isEditingName={editingSessionId === cardData.session.sessionId}
                  editingName={editingName}
                  editInputRef={editInputRef}
                  isCopied={copiedSessionId === cardData.session.sessionId}
                  isArchiving={archivingSessionId === cardData.session.sessionId}
                  isShownOnMap={sessionShownOnMap === cardData.session.sessionId}
                  onStartEditName={() => startEditingSessionName(cardData.session.sessionId, cardData.session.customName)}
                  onSaveEditName={saveSessionName}
                  onCancelEditName={cancelEditingSessionName}
                  onEditNameChange={setEditingName}
                  onCopySessionId={() => copySessionIdToClipboard(cardData.session.sessionId)}
                  onOpenTerminal={() => onOpenTerminal?.(cardData.session.sessionId, cardData.session.customName)}
                  onShowContext={() => onShowContext?.(cardData.session.sessionId)}
                  onArchive={() => archiveSession(cardData.session.sessionId)}
                  onToggleShowOnMap={() => {
                    // Toggle showing this session on the map
                    const newSessionId = sessionShownOnMap === cardData.session.sessionId ? null : cardData.session.sessionId;
                    setSessionShownOnMap(newSessionId);
                    // Notify parent of the change
                    onSessionMapVisibilityChange?.(newSessionId);
                  }}
                  onViewEvents={() => {
                    // Open event viewer modal for this session
                    setEventViewerSession({
                      id: cardData.session.sessionId,
                      name: cardData.session.customName || `Session ${cardData.session.sessionId.substring(0, 8)}`
                    });
                  }}
                  onOpenInEditor={async (filePath) => {
                    try {
                      // Get user's preferred editor
                      const { UserPreferencesService } = await import('../../../main-process-api/UserPreferencesService');
                      const { DEFAULT_EDITOR } = await import('../../../../shared/types/editor.types');
                      const preferences = await UserPreferencesService.getPreferences();
                      const preferredEditor = preferences.defaultEditor || DEFAULT_EDITOR;
                      
                      const result = await window.mainProcess?.shell?.openInEditor({
                        editor: preferredEditor,
                        dir: filePath
                      });
                      if (!result?.success) {
                        console.error('Failed to open file in editor:', result?.error);
                      }
                    } catch (error) {
                      console.error('Error opening file in editor:', error);
                    }
                  }}
                  onOpenAllInEditor={async (filePaths) => {
                    try {
                      // Get user's preferred editor
                      const { UserPreferencesService } = await import('../../../main-process-api/UserPreferencesService');
                      const { DEFAULT_EDITOR } = await import('../../../../shared/types/editor.types');
                      const preferences = await UserPreferencesService.getPreferences();
                      const preferredEditor = preferences.defaultEditor || DEFAULT_EDITOR;
                      
                      // Open each file sequentially
                      for (const filePath of filePaths) {
                        const result = await window.mainProcess?.shell?.openInEditor({
                          editor: preferredEditor,
                          dir: filePath
                        });
                        if (!result?.success) {
                          console.error('Failed to open file in editor:', filePath, result?.error);
                        }
                      }
                    } catch (error) {
                      console.error('Error opening files in editor:', error);
                    }
                  }}
                  onHighlightFiles={(files, mode) => {
                    // This will be called when events are selected in the carousel
                    // We need to pass this to the repository map somehow
                    // For now, just log it
                    console.log('Highlight files on map:', files, mode);
                    // TODO: Implement map highlighting integration
                  }}
                  onSessionDetailSelect={() => {
                    if (onSessionDetailSelect) {
                      // Always pass the latest card data
                      const currentCardData = sessionCards.get(cardData.session.sessionId);
                      onSessionDetailSelect(cardData.session.sessionId, currentCardData || cardData);
                    }
                  }}
                  onOpenPackageCommands={async (project, index) => {
                    // Find the corresponding package layer
                    const packages = await fileTreeSourceService?.detectPackagesForSource(sourceId || '');
                    const matchingPackage = packages?.find(pkg => 
                      pkg.packageData.path === project.path || 
                      pkg.packageData.name === project.name
                    );
                    
                    if (matchingPackage) {
                      // Count how many sessions touched this package
                      const sessionsWithPackage = Array.from(sessionCards.values()).filter(card =>
                        card.touchedProjects?.some(p => p.path === project.path)
                      ).length;
                      
                      setSelectedPackageForCommands(matchingPackage);
                      setSelectedProjectForCommands(project);
                      setAffectedSessionsCount(sessionsWithPackage);
                      setCommandPanelOpen(true);
                    }
                  }}
                  getTimeAgo={getTimeAgo}
                />
              );
            })}
            
          </div>
        )}
      </div>
    </div>
    
    {/* Package Command Panel */}
    <PackageCommandPanel
      isOpen={commandPanelOpen}
      onClose={() => setCommandPanelOpen(false)}
      package={selectedPackageForCommands}
      touchedProject={selectedProjectForCommands || undefined}
      sessionCount={affectedSessionsCount}
      onRunCommand={handleRunPackageCommand}
      repositoryPath={repositoryPath}
    />
    
    {/* Agent Selection Modal */}
    {fileTreeSources && fileTreeSources.length > 0 && (
      <AgentSelectionModal
        isOpen={isAgentModalOpen}
        onClose={() => setIsAgentModalOpen(false)}
        sources={fileTreeSources}
        repositoryName={repository?.name}
      />
    )}
    
    {/* Event History Modal */}
    {eventViewerSession && (
      <EventHistoryModal
        sessionId={eventViewerSession.id}
        session={sessionCards.get(eventViewerSession.id)?.session || null}
        isOpen={!!eventViewerSession}
        onClose={() => setEventViewerSession(null)}
      />
    )}
    </>
  );
};
