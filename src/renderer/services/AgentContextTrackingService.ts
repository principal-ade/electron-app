/**
 * AgentContextTrackingService - Track files accessed by agents
 *
 * This service listens to agent events and maintains a tree of all files
 * that have been read, written, edited, or listed by each agent session.
 */

import type { RepoNormalizedUniversalAgentSessionEvent } from '@principal-ai/agent-monitoring';
import type {
  LoadedFileTreeSource,
  FileTreeSource,
} from '@principal-ai/repository-abstraction';
import { PathsFileTreeBuilder } from '@principal-ai/repository-abstraction';
import { AgentSessionSDKService } from '../main-process-api/AgentSessionSDKService';

/**
 * Tracks which operations were performed on each file
 */
export interface FileAccessInfo {
  path: string;
  operations: Set<string>; // 'read', 'write', 'edit', 'list', etc.
  firstAccessed: number;
  lastAccessed: number;
  sessionId: string;
}

/**
 * Tracks all files accessed by a specific agent session
 */
export interface AgentSessionContext {
  sessionId: string;
  repositoryPath: string;
  repositoryInfo?: {
    owner: string;
    repo: string;
    branch?: string;
  };
  files: Map<string, FileAccessInfo>;
  startTime: number;
  lastActivity: number;
}

/**
 * Service for tracking agent file access across all sessions
 */
export class AgentContextTrackingService {
  private static sessions = new Map<string, AgentSessionContext>();
  private static listeners = new Set<
    (sessions: Map<string, AgentSessionContext>) => void
  >();
  private static isInitialized = false;

  /**
   * Initialize the tracking service
   */
  static initialize(): void {
    if (this.isInitialized) {
      return;
    }

    console.log('[AgentContextTrackingService] Initializing...');

    // Subscribe to agent events
    AgentSessionSDKService.onProcessedEvent((event) => {
      this.processEvent(event);
    });

    this.isInitialized = true;
    console.log('[AgentContextTrackingService] Initialized');
  }

  /**
   * Process an incoming agent event
   */
  private static processEvent(
    event: RepoNormalizedUniversalAgentSessionEvent,
  ): void {
    const { sessionId, repository, files, toolName, operation, timestamp } =
      event;

    // Only process events with file information
    if (!files || files.length === 0) {
      return;
    }

    const repositoryPath = repository?.root || event.workingDirectory;
    if (!repositoryPath) {
      return;
    }

    // Get or create session context
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        repositoryPath,
        repositoryInfo: repository
          ? {
              owner: repository.owner || '',
              repo: repository.repo || '',
              branch: repository.branch,
            }
          : undefined,
        files: new Map(),
        startTime: timestamp,
        lastActivity: timestamp,
      };
      this.sessions.set(sessionId, session);
    }

    // Update session activity
    session.lastActivity = timestamp;

    // Process each file in the event
    for (const fileInfo of files) {
      // Skip non-repository files
      if (!fileInfo.repository) {
        continue;
      }

      // Use relative path for repository files
      const filePath = fileInfo.repository.relativePath;

      // Get or create file access info
      let accessInfo = session.files.get(filePath);
      if (!accessInfo) {
        accessInfo = {
          path: filePath,
          operations: new Set(),
          firstAccessed: timestamp,
          lastAccessed: timestamp,
          sessionId,
        };
        session.files.set(filePath, accessInfo);
      }

      // Add operation if available
      if (operation) {
        accessInfo.operations.add(operation);
      } else if (toolName) {
        // Infer operation from tool name
        const inferredOp = this.inferOperationFromTool(toolName);
        if (inferredOp) {
          accessInfo.operations.add(inferredOp);
        }
      }

      accessInfo.lastAccessed = timestamp;
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Infer file operation from tool name
   */
  private static inferOperationFromTool(toolName: string): string | null {
    const toolLower = toolName.toLowerCase();

    if (toolLower === 'read') return 'read';
    if (toolLower === 'write') return 'write';
    if (toolLower === 'edit' || toolLower === 'multiedit') return 'edit';
    if (toolLower === 'glob' || toolLower === 'grep') return 'search';
    if (toolLower === 'ls') return 'list';

    return null;
  }

  /**
   * Get all tracked sessions
   */
  static getSessions(): Map<string, AgentSessionContext> {
    return new Map(this.sessions);
  }

  /**
   * Get sessions for a specific repository
   */
  static getSessionsForRepository(
    repositoryPath: string,
  ): AgentSessionContext[] {
    return Array.from(this.sessions.values()).filter(
      (session) => session.repositoryPath === repositoryPath,
    );
  }

  /**
   * Get a specific session by ID
   */
  static getSession(sessionId: string): AgentSessionContext | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Convert session contexts to LoadedFileTreeSource format for MultiFileTree
   */
  static getSessionsAsTreeSources(
    repositoryPath?: string,
  ): LoadedFileTreeSource[] {
    const sessions = repositoryPath
      ? this.getSessionsForRepository(repositoryPath)
      : Array.from(this.sessions.values());

    const builder = new PathsFileTreeBuilder();

    return sessions.map((session) => {
      // Get all file paths
      const filePaths = Array.from(session.files.keys());

      // Build file tree from paths
      const treeData = builder.build({
        files: filePaths,
        rootPath: session.repositoryPath,
      });

      // Create source metadata
      const source: FileTreeSource = {
        id: `agent-session-${session.sessionId}`,
        type: 'local',
        owner: session.repositoryInfo?.owner || 'unknown',
        name: session.repositoryInfo?.repo || 'repository',
        remoteUrl: '',
        location: session.repositoryPath,
        locationType: 'working',
        label: `Session ${session.sessionId.substring(0, 8)}`,
        provider: 'local',
        metadata: {
          sessionId: session.sessionId,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          fileCount: session.files.size,
        },
      };

      // Create loaded source
      const loadedSource: LoadedFileTreeSource = {
        ...source,
        tree: {
          sha: treeData.sha,
          metadata: treeData.metadata,
          root: treeData.root,
          allFiles: treeData.allFiles,
          allDirectories: treeData.allDirectories,
          stats: treeData.stats,
        },
        treeStats: {
          fileCount: treeData.stats.totalFiles,
          directoryCount: treeData.stats.totalDirectories,
          loadedAt: Date.now(),
        },
      };

      return loadedSource;
    });
  }

  /**
   * Subscribe to session updates
   */
  static subscribe(
    listener: (sessions: Map<string, AgentSessionContext>) => void,
  ): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of session changes
   */
  private static notifyListeners(): void {
    const sessionsCopy = this.getSessions();
    this.listeners.forEach((listener) => {
      try {
        listener(sessionsCopy);
      } catch (error) {
        console.error(
          '[AgentContextTrackingService] Error in listener:',
          error,
        );
      }
    });
  }

  /**
   * Clear a specific session
   */
  static clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.notifyListeners();
  }

  /**
   * Clear all sessions
   */
  static clearAllSessions(): void {
    this.sessions.clear();
    this.notifyListeners();
  }

  /**
   * Clear sessions for a specific repository
   */
  static clearRepositorySessions(repositoryPath: string): void {
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.repositoryPath === repositoryPath) {
        sessionsToDelete.push(sessionId);
      }
    }

    for (const sessionId of sessionsToDelete) {
      this.sessions.delete(sessionId);
    }

    if (sessionsToDelete.length > 0) {
      this.notifyListeners();
    }
  }

  /**
   * Get statistics about tracked sessions
   */
  static getStatistics(): {
    totalSessions: number;
    totalFiles: number;
    sessionsByRepository: Map<string, number>;
  } {
    const sessionsByRepository = new Map<string, number>();
    let totalFiles = 0;

    for (const session of this.sessions.values()) {
      const count = sessionsByRepository.get(session.repositoryPath) || 0;
      sessionsByRepository.set(session.repositoryPath, count + 1);
      totalFiles += session.files.size;
    }

    return {
      totalSessions: this.sessions.size,
      totalFiles,
      sessionsByRepository,
    };
  }
}

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  AgentContextTrackingService.initialize();
}
