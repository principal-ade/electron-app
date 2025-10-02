import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { GitService, GitDetailedChanges } from '../main-process-api/GitService';
import { RepositoryMonitoringService } from '../main-process-api/RepositoryMonitoringService';
import type { GitStatusMetadata } from '../../shared/main-process-api-interfaces/RepositoryMonitoringAPI';
import { HighlightLayer } from '@principal-ai/code-city-react';

// Source identifier for tracking multiple repositories/directories
export interface FileChangeSource {
  id: string; // Unique identifier for this source
  path: string; // Absolute path to the directory/repository
  type: 'git' | 'directory'; // Source type
  name?: string; // Human-readable name
}

// File change tracking per source
export interface SourceFileChanges {
  source: FileChangeSource;
  gitChanges?: GitDetailedChanges;
  lastUpdated: number;
  watcherStatus: 'idle' | 'active' | 'paused' | 'error';
  error?: string;
}

// Session file activity tracking
export interface SessionFileActivity {
  sessionId: string;
  agentType: string;
  agentName?: string;
  filePath: string; // Relative path from repo root
  absolutePath?: string; // Full system path
  operations: Array<{
    type: 'read' | 'write' | 'edit';
    timestamp: number;
    tool?: string;
  }>;
  lastModified: number;
  isActive?: boolean; // Is this session currently active
}

// File collision detection
export interface FileCollision {
  filePath: string;
  sourcePath: string;
  type: 'multi-agent' | 'git-conflict' | 'both';
  severity: 'low' | 'medium' | 'high';
  agents: Array<{
    sessionId: string;
    agentType: string;
    lastOperation: 'read' | 'write' | 'edit';
    timestamp: number;
  }>;
  gitStatus?: 'modified' | 'staged' | 'conflicted';
  description?: string;
}

// Provider context value
export interface FileChangeContextValue {
  // Source management
  sources: Map<string, SourceFileChanges>;
  activeSourceId: string | null;

  // Methods
  registerSource: (source: FileChangeSource) => void;
  unregisterSource: (sourceId: string) => void;
  setActiveSource: (sourceId: string) => void;
  refreshSource: (sourceId: string) => Promise<void>;

  // Session file tracking
  sessionFileActivities: Map<string, SessionFileActivity[]>;
  registerSessionActivity: (
    sourceId: string,
    activity: SessionFileActivity,
  ) => void;

  // Collision detection
  collisions: Map<string, FileCollision[]>;

  // Highlight layers generation
  getHighlightLayers: (
    sourceId: string,
    options?: {
      showGitChanges?: boolean;
      showSessionChanges?: boolean;
      showUnattributed?: boolean;
      showCollisions?: boolean;
      activeSessionOnly?: boolean;
    },
  ) => HighlightLayer[];

  // Global watcher control
  pauseAllWatchers: () => void;
  resumeAllWatchers: () => void;
}

const FileChangeContext = createContext<FileChangeContextValue | null>(null);

export const useFileChanges = () => {
  const context = useContext(FileChangeContext);
  if (!context) {
    throw new Error('useFileChanges must be used within FileChangeProvider');
  }
  return context;
};

interface FileChangeProviderProps {
  children: React.ReactNode;
}

export const FileChangeProvider: React.FC<FileChangeProviderProps> = ({
  children,
}) => {
  const [sources, setSources] = useState<Map<string, SourceFileChanges>>(
    new Map(),
  );
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [sessionFileActivities, setSessionFileActivities] = useState<
    Map<string, SessionFileActivity[]>
  >(new Map());
  const [collisions, setCollisions] = useState<Map<string, FileCollision[]>>(
    new Map(),
  );

  // Use ref to store sources for use in callbacks without causing re-renders
  const sourcesRef = useRef<Map<string, SourceFileChanges>>(new Map());

  // Update ref when sources change
  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  // Refresh changes for a specific source
  const refreshSource = useCallback(async (sourceId: string) => {
    const sourceData = sourcesRef.current.get(sourceId);
    if (!sourceData) {
      console.warn(`[FileChangeProvider] Source ${sourceId} not found`);
      return;
    }

    const { source } = sourceData;

    if (source.type === 'git') {
      try {
        console.info(
          `[FileChangeProvider] Fetching git changes for ${source.path}`,
        );

        // Update status to active
        setSources((prev) => {
          const newSources = new Map(prev);
          const existing = newSources.get(sourceId);
          if (existing) {
            newSources.set(sourceId, {
              ...existing,
              watcherStatus: 'active',
            });
          }
          return newSources;
        });

        const changes = await GitService.getDetailedChanges(source.path);

        console.info(`[FileChangeProvider] Git changes for ${source.path}:`, {
          created: changes.created.length,
          modified: changes.modified.length,
          deleted: changes.deleted.length,
          renamed: changes.renamed.length,
          createdFiles: changes.created.slice(0, 5),
          deletedFiles: changes.deleted.slice(0, 5),
        });

        // Update with results
        setSources((prev) => {
          const newSources = new Map(prev);
          const existing = newSources.get(sourceId);
          if (existing) {
            newSources.set(sourceId, {
              ...existing,
              gitChanges: changes,
              lastUpdated: Date.now(),
              watcherStatus: 'idle',
              error: undefined,
            });
          }
          return newSources;
        });

        // Check for collisions after update
        if (detectCollisionsRef.current) {
          detectCollisionsRef.current(sourceId);
        }
      } catch (error) {
        console.error(
          `[FileChangeProvider] Error fetching changes for ${source.path}:`,
          error,
        );

        setSources((prev) => {
          const newSources = new Map(prev);
          const existing = newSources.get(sourceId);
          if (existing) {
            newSources.set(sourceId, {
              ...existing,
              watcherStatus: 'error',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
          return newSources;
        });
      }
    }
  }, []);

  // Register a new source for tracking
  const registerSource = useCallback(
    (source: FileChangeSource) => {
      // Check if already registered using ref to avoid dependency issues
      if (sourcesRef.current.has(source.id)) {
        console.info(
          `[FileChangeProvider] Source ${source.id} already registered, skipping`,
        );
        return;
      }

      console.info(
        `[FileChangeProvider] Registering source: ${source.id} at ${source.path}`,
      );

      setSources((prev) => {
        const newSources = new Map(prev);
        // Double check in the setter too
        if (!newSources.has(source.id)) {
          newSources.set(source.id, {
            source,
            lastUpdated: Date.now(),
            watcherStatus: 'active', // Assume active since GitRepositoryWatcher handles it
          });
        }
        return newSources;
      });

      // Start git watching for git sources
      if (source.type === 'git') {
        RepositoryMonitoringService.enableGitWatching(source.path).then((result) => {
          if (!result.success) {
            console.error(
              `[FileChangeProvider] Failed to watch repository ${source.path}:`,
              result.error,
            );
          }
        });
      }

      // Initial fetch for this source after a short delay to ensure state is updated
      setTimeout(() => {
        refreshSource(source.id);
      }, 100);
    },
    [refreshSource],
  );

  // Unregister a source
  const unregisterSource = useCallback((sourceId: string) => {
    console.info(`[FileChangeProvider] Unregistering source: ${sourceId}`);

    // Get the source data to stop watching if needed
    const sourceData = sourcesRef.current.get(sourceId);
    if (sourceData && sourceData.source.type === 'git') {
      RepositoryMonitoringService.disableGitWatching(sourceData.source.path);
    }

    // Remove from state
    setSources((prev) => {
      const newSources = new Map(prev);
      newSources.delete(sourceId);
      return newSources;
    });

    // Clean up related data
    setSessionFileActivities((prev) => {
      const newActivities = new Map(prev);
      newActivities.delete(sourceId);
      return newActivities;
    });

    setCollisions((prev) => {
      const newCollisions = new Map(prev);
      newCollisions.delete(sourceId);
      return newCollisions;
    });
  }, []);

  // Listen for git status updates from GitWatcher
  useEffect(() => {
    const handleGitStatusUpdate = (status: GitStatusMetadata) => {
      // Find the source matching this repo path
      sourcesRef.current.forEach((sourceData, sourceId) => {
        if (
          sourceData.source.type === 'git' &&
          sourceData.source.path === status.repoPath
        ) {
          // Refresh this source when we get an update
          refreshSource(sourceId);
        }
      });
    };

    // Listen for status updates from Repository Monitoring Service
    const unsubscribe = RepositoryMonitoringService.onGitStatusChanged(handleGitStatusUpdate);

    return () => {
      unsubscribe();
    };
  }, [refreshSource]);

  // Detect collisions needs to be defined before registerSessionActivity
  const detectCollisionsRef = useRef<((sourceId: string) => void) | undefined>(undefined);

  // Register session file activity
  const registerSessionActivity = useCallback(
    (sourceId: string, activity: SessionFileActivity) => {
      setSessionFileActivities((prev) => {
        const newActivities = new Map(prev);
        const sourceActivities = newActivities.get(sourceId) || [];

        // Update or add activity
        const existingIndex = sourceActivities.findIndex(
          (a) =>
            a.sessionId === activity.sessionId &&
            a.filePath === activity.filePath,
        );

        if (existingIndex >= 0) {
          sourceActivities[existingIndex] = activity;
        } else {
          sourceActivities.push(activity);
        }

        newActivities.set(sourceId, sourceActivities);
        return newActivities;
      });

      // Check for collisions
      if (detectCollisionsRef.current) {
        detectCollisionsRef.current(sourceId);
      }
    },
    [],
  );

  // Detect collisions for a source
  const detectCollisions = useCallback(
    (sourceId: string) => {
      const sourceData = sourcesRef.current.get(sourceId);
      const activities = sessionFileActivities.get(sourceId) || [];

      if (!sourceData) return;

      const detectedCollisions: FileCollision[] = [];
      const fileActivityMap = new Map<string, SessionFileActivity[]>();

      // Group activities by file
      activities.forEach((activity) => {
        const existing = fileActivityMap.get(activity.filePath) || [];
        existing.push(activity);
        fileActivityMap.set(activity.filePath, existing);
      });

      // Check each file for collisions
      fileActivityMap.forEach((fileActivities, filePath) => {
        // Multi-agent collision
        if (fileActivities.length > 1) {
          const collision: FileCollision = {
            filePath,
            sourcePath: sourceData.source.path,
            type: 'multi-agent',
            severity: 'medium',
            agents: fileActivities.map((activity) => ({
              sessionId: activity.sessionId,
              agentType: activity.agentType,
              lastOperation:
                activity.operations[activity.operations.length - 1]?.type ||
                'read',
              timestamp: activity.lastModified,
            })),
            description: `${fileActivities.length} agents have modified this file`,
          };

          // Check if also has git changes
          if (sourceData.gitChanges) {
            const hasGitChanges =
              sourceData.gitChanges.modified.includes(filePath) ||
              sourceData.gitChanges.created.includes(filePath);

            if (hasGitChanges) {
              collision.type = 'both';
              collision.severity = 'high';
              collision.gitStatus = 'modified';
              collision.description = `${fileActivities.length} agents + uncommitted git changes`;
            }
          }

          detectedCollisions.push(collision);
        }
        // Single agent but git conflict
        else if (fileActivities.length === 1 && sourceData.gitChanges) {
          const hasGitChanges =
            sourceData.gitChanges.modified.includes(filePath);

          if (hasGitChanges) {
            detectedCollisions.push({
              filePath,
              sourcePath: sourceData.source.path,
              type: 'git-conflict',
              severity: 'low',
              agents: [
                {
                  sessionId: fileActivities[0].sessionId,
                  agentType: fileActivities[0].agentType,
                  lastOperation:
                    fileActivities[0].operations[
                      fileActivities[0].operations.length - 1
                    ]?.type || 'read',
                  timestamp: fileActivities[0].lastModified,
                },
              ],
              gitStatus: 'modified',
              description: 'Agent modified file with uncommitted changes',
            });
          }
        }
      });

      setCollisions((prev) => {
        const newCollisions = new Map(prev);
        newCollisions.set(sourceId, detectedCollisions);
        return newCollisions;
      });
    },
    [sessionFileActivities],
  );

  // Update ref for detectCollisions
  useEffect(() => {
    detectCollisionsRef.current = detectCollisions;
  }, [detectCollisions]);

  // Calculate unattributed changes (git changes not made by any session)
  const calculateUnattributedChanges = useCallback(
    (sourceId: string): string[] => {
      const sourceData = sources.get(sourceId);
      const activities = sessionFileActivities.get(sourceId) || [];

      if (!sourceData?.gitChanges) return [];

      // Get all files touched by sessions
      const sessionFiles = new Set<string>();
      activities.forEach((activity) => {
        // Only count writes/edits, not reads
        const hasWrite = activity.operations.some(
          (op) => op.type === 'write' || op.type === 'edit',
        );
        if (hasWrite) {
          sessionFiles.add(activity.filePath);
        }
      });

      // Calculate unattributed changes
      const unattributed: string[] = [];

      // Check modified files
      sourceData.gitChanges.modified.forEach((file) => {
        if (!sessionFiles.has(file)) {
          unattributed.push(file);
        }
      });

      // Check created files
      sourceData.gitChanges.created.forEach((file) => {
        if (!sessionFiles.has(file)) {
          unattributed.push(file);
        }
      });

      return unattributed;
    },
    [sources, sessionFileActivities],
  );

  // Generate highlight layers for a source
  const getHighlightLayers = useCallback(
    (
      sourceId: string,
      options?: {
        showGitChanges?: boolean;
        showSessionChanges?: boolean;
        showUnattributed?: boolean;
        showCollisions?: boolean;
        activeSessionOnly?: boolean;
      },
    ): HighlightLayer[] => {
      const opts = {
        showGitChanges: false, // Default off since we'll show session/unattributed instead
        showSessionChanges: true,
        showUnattributed: true,
        showCollisions: true,
        activeSessionOnly: false,
        ...options,
      };

      const sourceData = sources.get(sourceId);
      if (!sourceData) return [];

      const layers: HighlightLayer[] = [];
      const activities = sessionFileActivities.get(sourceId) || [];

      // Session file layers (grouped by session)
      if (opts.showSessionChanges) {
        const sessionGroups = new Map<
          string,
          {
            reads: Set<string>;
            writes: Set<string>;
            agentName?: string;
            isActive?: boolean;
          }
        >();

        activities.forEach((activity) => {
          if (opts.activeSessionOnly && !activity.isActive) {
            console.info(
              '[FileChangeProvider] Skipping inactive session:',
              activity.sessionId,
            );
            return;
          }

          let group = sessionGroups.get(activity.sessionId);
          if (!group) {
            group = {
              reads: new Set(),
              writes: new Set(),
              agentName: activity.agentName,
              isActive: activity.isActive,
            };
            sessionGroups.set(activity.sessionId, group);
          }

          activity.operations.forEach((op) => {
            if (!group) return;
            if (op.type === 'read') {
              group.reads.add(activity.filePath);
            } else {
              group.writes.add(activity.filePath);
            }
          });
        });

        // Create layers for each session
        let colorIndex = 0;
        const sessionColors = ['#8b5cf6', '#06b6d4', '#ec4899', '#f59e0b'];

        sessionGroups.forEach((group, sessionId) => {
          const color = sessionColors[colorIndex % sessionColors.length];
          const sessionLabel = group.agentName || sessionId.substring(0, 8);
          const activeLabel = group.isActive ? ' (Active)' : '';
          colorIndex++;

          if (group.writes.size > 0) {
            layers.push({
              id: `session-${sessionId}-writes`,
              name: `${sessionLabel}${activeLabel} - Writes (${group.writes.size})`,
              enabled: true,
              color,
              priority: 20 + colorIndex,
              items: Array.from(group.writes).map((path) => ({
                path,
                type: 'file' as const,
              })),
            });
          }

          if (group.reads.size > 0) {
            layers.push({
              id: `session-${sessionId}-reads`,
              name: `${sessionLabel}${activeLabel} - Reads (${group.reads.size})`,
              enabled: true,
              color,
              priority: 10 + colorIndex,
              opacity: 0.5, // Reads are less prominent
              items: Array.from(group.reads).map((path) => ({
                path,
                type: 'file' as const,
              })),
            });
          }
        });
      }

      // Unattributed changes layer
      if (opts.showUnattributed && sourceData.gitChanges) {
        const unattributed = calculateUnattributedChanges(sourceId);
        if (unattributed.length > 0) {
          layers.push({
            id: `${sourceId}-unattributed`,
            name: `Unattributed Changes (${unattributed.length})`,
            enabled: true,
            color: '#64748b', // Gray for unknown origin
            priority: 15,
            items: unattributed.map((path) => ({
              path,
              type: 'file' as const,
            })),
          });
        }
      }

      // Git changes layers (if requested - useful for overview)
      if (opts.showGitChanges && sourceData.gitChanges) {
        const { gitChanges } = sourceData;

        if (gitChanges.modified.length > 0) {
          layers.push({
            id: `${sourceId}-git-modified`,
            name: `Git Modified (${gitChanges.modified.length})`,
            enabled: true, // On by default
            color: '#f59e0b',
            priority: 5,
            opacity: 0.6, // Semi-transparent fill
            items: gitChanges.modified.map((path) => ({
              path,
              type: 'file' as const,
              renderStrategy: 'fill' as const, // Use fill instead of border
            })),
          });
        }

        if (gitChanges.created.length > 0) {
          layers.push({
            id: `${sourceId}-git-created`,
            name: `Git Created (${gitChanges.created.length})`,
            enabled: true, // On by default
            color: '#10b981',
            priority: 4,
            opacity: 0.6, // Semi-transparent fill
            items: gitChanges.created.map((path) => ({
              path,
              type: 'file' as const,
              renderStrategy: 'fill' as const, // Use fill instead of border
            })),
          });
        }

        if (gitChanges.deleted.length > 0) {
          layers.push({
            id: `${sourceId}-git-deleted`,
            name: `Git Deleted (${gitChanges.deleted.length})`,
            enabled: true, // On by default
            color: '#ef4444',
            priority: 3,
            opacity: 0.6, // Semi-transparent fill
            items: gitChanges.deleted.map((path) => ({
              path,
              type: 'file' as const,
              renderStrategy: 'fill' as const, // Use fill instead of border
            })),
          });
        }
      }

      // Collision layer
      if (opts.showCollisions) {
        const sourceCollisions = collisions.get(sourceId) || [];
        if (sourceCollisions.length > 0) {
          layers.push({
            id: `${sourceId}-collisions`,
            name: `⚠️ Collisions (${sourceCollisions.length})`,
            enabled: true,
            color: '#dc2626',
            priority: 30, // Highest priority
            items: sourceCollisions.map((c) => ({
              path: c.filePath,
              type: 'file' as const,
            })),
          });
        }
      }

      return layers;
    },
    [sources, collisions, sessionFileActivities, calculateUnattributedChanges],
  );

  // Pause all watchers
  const pauseAllWatchers = useCallback(() => {
    setSources((prev) => {
      const newSources = new Map(prev);
      newSources.forEach((value, key) => {
        newSources.set(key, {
          ...value,
          watcherStatus: 'paused',
        });
      });
      return newSources;
    });
  }, []);

  // Resume all watchers
  const resumeAllWatchers = useCallback(() => {
    // Trigger immediate refresh for all sources
    sourcesRef.current.forEach((_, sourceId) => {
      refreshSource(sourceId);
    });
  }, [refreshSource]);

  const value: FileChangeContextValue = useMemo(
    () => ({
      sources,
      activeSourceId,
      registerSource,
      unregisterSource,
      setActiveSource: setActiveSourceId,
      refreshSource,
      sessionFileActivities,
      registerSessionActivity,
      collisions,
      getHighlightLayers,
      pauseAllWatchers,
      resumeAllWatchers,
    }),
    [
      sources,
      activeSourceId,
      registerSource,
      unregisterSource,
      setActiveSourceId,
      refreshSource,
      sessionFileActivities,
      registerSessionActivity,
      collisions,
      getHighlightLayers,
      pauseAllWatchers,
      resumeAllWatchers,
    ],
  );

  return (
    <FileChangeContext.Provider value={value}>
      {children}
    </FileChangeContext.Provider>
  );
};
