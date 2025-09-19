import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { GitRepositoryService } from '../file-system/gitRepositoryService';
import {
  DirectorySessionsResult,
  SessionSummary,
} from '../services/store/types';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { getTypedStorageManager } from '../storage-providers';
import type { TypedMultiStoreWrapper } from '../storage-providers';
import { StaticNamespaces } from '../../shared/types/namespaces.types';
import {
  LastEventType,
  EventActivityType,
  FileOperation,
  AutoCommitStatus,
  StopTrigger,
  ToolName,
} from '../../shared/sessionEnums';

export class AgentSessionService {
  private static instance: AgentSessionService;

  private storageManager: TypedMultiStoreWrapper | null = null;

  private gitService: GitRepositoryService;

  private constructor() {
    this.gitService = new GitRepositoryService();
  }

  static getInstance(): AgentSessionService {
    if (!AgentSessionService.instance) {
      AgentSessionService.instance = new AgentSessionService();
    }
    return AgentSessionService.instance;
  }

  async getStorageManager() {
    if (!this.storageManager) {
      this.storageManager = await getTypedStorageManager();
    }
    return this.storageManager;
  }

  // Helper to get global sessions from storage
  async getGlobalSessions(): Promise<{
    sessions: Record<string, AgentSessionRecord>;
    activeSessionsByDirectory: Record<string, string>;
  }> {
    const storageManager = await this.getStorageManager();
    const result = await storageManager.get(
      'globalAgentSessions',
      StaticNamespaces.GLOBAL_SESSION_REGISTRY,
    );
    if (result.success && result.data) {
      return result.data;
    }
    return {
      sessions: {},
      activeSessionsByDirectory: {},
    };
  }

  // Helper to save global sessions to storage
  async saveGlobalSessions(globalSessions: {
    sessions: Record<string, AgentSessionRecord>;
    activeSessionsByDirectory: Record<string, string>;
  }): Promise<void> {
    const storageManager = await this.getStorageManager();
    await storageManager.set(
      'globalAgentSessions',
      globalSessions,
      StaticNamespaces.GLOBAL_SESSION_REGISTRY,
    );
  }

  // Get user preferences
  async getUserPreferences() {
    const storageManager = await this.getStorageManager();
    const result = await storageManager.get(
      'userPreferences',
      StaticNamespaces.USER_PREFERENCES,
    );
    const prefs = result.success ? result.data : undefined;
    return {
      autoCommitOnStop: prefs?.autoCommitOnStop ?? true, // Default to true
    };
  }

  // Update user preferences
  async updateUserPreferences(preferences: { autoCommitOnStop?: boolean }) {
    const storageManager = await this.getStorageManager();
    const result = await storageManager.get(
      'userPreferences',
      StaticNamespaces.USER_PREFERENCES,
    );
    const currentPrefs = result.success && result.data ? result.data : {};
    await storageManager.set(
      'userPreferences',
      { ...currentPrefs, ...preferences },
      StaticNamespaces.USER_PREFERENCES,
    );
  }

  // Extract file path from tool parameters
  private extractFilePathFromTool(
    toolName: string,
    parameters: any,
  ): string | null {
    switch (toolName) {
      case 'Read':
      case 'Edit':
      case 'Write':
      case 'MultiEdit':
        return parameters?.file_path || null;
      case 'NotebookRead':
      case 'NotebookEdit':
        return parameters?.notebook_path || null;
      case 'Glob':
      case 'Grep':
      case 'LS':
        return parameters?.path || null;
      default:
        return null;
    }
  }

  // Resolve and normalize file path
  private async resolveAndNormalizePath(
    filePath: string,
    workingDirectory: string,
    gitRoot?: string,
  ): Promise<{
    absolutePath: string;
    normalizedPath: string;
    exists: boolean;
  }> {
    try {
      // Resolve to absolute path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(workingDirectory, filePath);

      // Check if file exists
      const exists = fs.existsSync(absolutePath);

      // Get canonical path if it exists (resolves symlinks)
      let canonicalPath = absolutePath;
      if (exists) {
        try {
          canonicalPath = fs.realpathSync(absolutePath);
        } catch (error) {
          console.warn(
            `[AgentSessionService] Failed to get real path for ${absolutePath}:`,
            error,
          );
        }
      }

      // Normalize relative to git root
      let normalizedPath = canonicalPath;
      if (gitRoot && canonicalPath.startsWith(gitRoot)) {
        // Use path.relative to get a clean relative path
        normalizedPath = path.relative(gitRoot, canonicalPath);
        // Ensure forward slashes for consistency
        normalizedPath = normalizedPath.replace(/\\/g, '/');
        // Add leading slash for consistency with UI expectations
        normalizedPath = `/${normalizedPath}`;
      } else if (gitRoot) {
        // Path is outside git root - just use the basename
        normalizedPath = `[EXTERNAL]/${path.basename(canonicalPath)}`;
      }

      return {
        absolutePath: canonicalPath,
        normalizedPath,
        exists,
      };
    } catch (error) {
      console.error(
        `[AgentSessionService] Error resolving path ${filePath}:`,
        error,
      );
      // Return a fallback
      return {
        absolutePath: filePath,
        normalizedPath: path.basename(filePath),
        exists: false,
      };
    }
  }

  // Get all sessions for a directory (requires git repository information)
  async getSessionsForDirectory(
    directory: string,
  ): Promise<DirectorySessionsResult> {
    const globalSessions = await this.getGlobalSessions();

    // Get basic git info for the directory to find its git root
    let gitRoot: string | null = null;
    try {
      const gitInfo = await this.getBasicGitInfo(directory);
      gitRoot = gitInfo?.gitRoot || null;
    } catch (error) {
      console.log(
        `[AgentSessionService] Could not get git info for directory ${directory}:`,
        error,
      );
    }

    let directorySessions: AgentSessionRecord[];

    if (gitRoot) {
      // Only include sessions that belong to this git repository and have proper git info
      directorySessions = Object.values(globalSessions.sessions).filter(
        (s) => s.basicGitInfo?.gitRoot === gitRoot,
      );
      console.log(
        `[AgentSessionService] Retrieved sessions for git root: ${gitRoot}, found: ${directorySessions.length} sessions`,
      );
    } else {
      // No git repository found - return empty results
      directorySessions = [];
      console.log(
        `[AgentSessionService] No git repository found for directory: ${directory}, returning empty results`,
      );
    }

    const activeSessionId =
      globalSessions.activeSessionsByDirectory[directory] || null;

    // DEBUG: Log lastEvent data for retrieved sessions
    console.log(
      `[AgentSessionService] Retrieved sessions for ${directory}:`,
      directorySessions.map((s) => ({
        sessionId: s.sessionId.slice(0, 8),
        hasLastEvent: !!s.lastEvent,
        lastEventData: s.lastEvent,
        hasLastToolActivity: !!s.lastToolActivity,
        lastToolActivityData: s.lastToolActivity,
      })),
    );

    return { sessions: directorySessions, activeSessionId };
  }

  // Get a specific session (now searches globally)
  async getSession(
    directory: string,
    sessionId: string,
  ): Promise<AgentSessionRecord | null> {
    const globalSessions = await this.getGlobalSessions();

    console.log(`[AgentSessionService] Looking for session ${sessionId}`);
    console.log(
      `[AgentSessionService] Total sessions in store:`,
      Object.keys(globalSessions.sessions).length,
    );
    console.log(
      `[AgentSessionService] Exact match check for '${sessionId}':`,
      globalSessions.sessions[sessionId] ? 'EXISTS' : 'NOT FOUND',
    );

    // Look up session by ID directly from the Record
    const session = globalSessions.sessions[sessionId] || null;
    console.log(`[AgentSessionService] Session found:`, session ? 'yes' : 'no');

    if (session) {
      console.log(
        `[AgentSessionService] Retrieved session ${sessionId.slice(0, 8)}:`,
        {
          hasLastEvent: !!session.lastEvent,
          lastEventType: session.lastEvent?.type,
          hasLastToolActivity: !!session.lastToolActivity,
          lastToolActivityType: session.lastToolActivity?.type,
        },
      );
    }

    return session;
  }

  // Create or update a session
  async upsertSession(
    directory: string,
    session: AgentSessionRecord,
  ): Promise<void> {
    const globalSessions = await this.getGlobalSessions();

    console.log(
      `[AgentSessionService] Upserting session ${session.sessionId} for directory ${directory}`,
      {
        hasLastEvent: !!session.lastEvent,
        lastEventType: session.lastEvent?.type,
        hasLastToolActivity: !!session.lastToolActivity,
      },
    );

    // Ensure session has workingDirectory set
    if (!session.workingDirectory) {
      session.workingDirectory = directory;
    }

    // Simply set the session by its ID
    globalSessions.sessions[session.sessionId] = session;
    console.log(
      `[AgentSessionService] Session stored. Total sessions now:`,
      Object.keys(globalSessions.sessions).length,
    );

    // Keep only the last 1000 sessions globally
    const sessionEntries = Object.entries(globalSessions.sessions);
    if (sessionEntries.length > 1000) {
      // Sort by last activity and keep the most recent 1000
      const sortedSessions = sessionEntries
        .sort(([, a], [, b]) => b.lastActivity - a.lastActivity)
        .slice(0, 1000);
      globalSessions.sessions = Object.fromEntries(sortedSessions);
    }

    await this.saveGlobalSessions(globalSessions);
    console.log(
      `[AgentSessionService] Stored session globally - ID: ${session.sessionId}, Directory: ${directory}, Total sessions: ${Object.keys(globalSessions.sessions).length}`,
    );
    this.notifyWindows('agent-session-updated', {
      directory,
      workingDirectory: directory,
      sessionId: session.sessionId,
      session,
      sessionData: session,
    });
  }

  // Set active session
  async setActiveSession(
    directory: string,
    sessionId: string | null,
  ): Promise<void> {
    const globalSessions = await this.getGlobalSessions();

    if (sessionId) {
      globalSessions.activeSessionsByDirectory[directory] = sessionId;
    } else {
      delete globalSessions.activeSessionsByDirectory[directory];
    }

    await this.saveGlobalSessions(globalSessions);
    this.notifyWindows('agent-session-active-changed', {
      directory,
      sessionId,
    });
  }

  // Add file access
  async addFileAccess(
    directory: string,
    sessionId: string,
    filePath: string,
    metadata?: any,
  ): Promise<void> {
    const session = await this.getSession(directory, sessionId);
    if (!session) return;

    // Check and save git info if missing (saves to database)
    const updatedSession = await this.checkAndSaveGitInfoIfMissing(
      session,
      directory,
    );

    if (!updatedSession.fileAccesses[filePath]) {
      updatedSession.fileAccesses[filePath] = [];
    }

    const timestamp = Date.now();

    // Resolve and normalize the path
    const workingDirectory = metadata?.workingDirectory || directory;
    const resolved = await this.resolveAndNormalizePath(
      filePath,
      workingDirectory,
      updatedSession.basicGitInfo?.gitRoot,
    );

    updatedSession.fileAccesses[filePath].push({
      timestamp,
      normalizedPath: resolved.normalizedPath,
      metadata: {
        ...metadata,
        absolutePath: resolved.absolutePath,
        exists: resolved.exists,
      },
    });

    // Update lastToolActivity for file reads (DEPRECATED - keeping during migration)
    const fileName = filePath.split('/').pop() || 'unknown';
    updatedSession.lastToolActivity = {
      type: 'read',
      fileName,
      filePath, // Include full path for map visualization
      timestamp,
    };

    // NEW: Update consolidated lastEvent field
    updatedSession.lastEvent = {
      type: EventActivityType.READ,
      fileName,
      filePath,
      timestamp,
      metadata,
    };

    console.log(
      `[AgentSessionService] Set lastEvent for file read in ${sessionId.slice(0, 8)}:`,
      {
        lastEvent: updatedSession.lastEvent,
        fileName,
        filePath,
      },
    );

    updatedSession.lastActivity = timestamp;
    updatedSession.lastEventType = LastEventType.FILE_READ;

    console.log(
      `[AgentSessionService] About to save session with lastEvent for file read:`,
      {
        sessionId: sessionId.slice(0, 8),
        lastEvent: updatedSession.lastEvent,
        lastToolActivity: updatedSession.lastToolActivity,
      },
    );

    await this.upsertSession(directory, updatedSession);

    console.log(
      `[AgentSessionService] Session saved successfully for file read ${sessionId.slice(0, 8)}`,
    );
  }

  // Add file write
  async addFileWrite(
    directory: string,
    sessionId: string,
    filePath: string,
    operation: string,
    metadata?: any,
  ): Promise<void> {
    console.log(
      `[AgentSessionService] addFileWrite called for ${sessionId.slice(0, 8)}:`,
      {
        filePath,
        operation,
        metadata,
      },
    );

    const session = await this.getSession(directory, sessionId);
    if (!session) {
      console.log(
        `[AgentSessionService] Session not found for addFileWrite: ${sessionId.slice(0, 8)}`,
      );
      return;
    }

    // Check and save git info if missing (saves to database)
    const updatedSession = await this.checkAndSaveGitInfoIfMissing(
      session,
      directory,
    );

    if (!updatedSession.fileWrites[filePath]) {
      updatedSession.fileWrites[filePath] = [];
    }

    const timestamp = Date.now();

    // Resolve and normalize the path
    const workingDirectory = metadata?.workingDirectory || directory;
    const resolved = await this.resolveAndNormalizePath(
      filePath,
      workingDirectory,
      updatedSession.basicGitInfo?.gitRoot,
    );

    updatedSession.fileWrites[filePath].push({
      timestamp,
      operation,
      normalizedPath: resolved.normalizedPath,
      metadata: {
        ...metadata,
        absolutePath: resolved.absolutePath,
        exists: resolved.exists,
      },
    });

    // Update lastToolActivity for file writes (DEPRECATED - keeping during migration)
    const fileName = filePath.split('/').pop() || 'unknown';
    const activityType = operation === FileOperation.CREATE ? 'write' : 'edit';
    updatedSession.lastToolActivity = {
      type: activityType,
      fileName,
      filePath, // Include full path for map visualization
      timestamp,
    };

    // NEW: Update consolidated lastEvent field
    updatedSession.lastEvent = {
      type:
        operation === FileOperation.CREATE
          ? EventActivityType.WRITE
          : EventActivityType.EDIT,
      fileName,
      filePath,
      timestamp,
      metadata,
    };

    console.log(
      `[AgentSessionService] Set lastEvent for file write in ${sessionId.slice(0, 8)}:`,
      {
        lastEvent: updatedSession.lastEvent,
        operation,
        fileName,
        filePath,
      },
    );

    updatedSession.lastActivity = timestamp;
    updatedSession.lastEventType = LastEventType.FILE_WRITE;

    console.log(`[AgentSessionService] About to save session with lastEvent:`, {
      sessionId: sessionId.slice(0, 8),
      lastEvent: updatedSession.lastEvent,
      lastToolActivity: updatedSession.lastToolActivity,
    });

    await this.upsertSession(directory, updatedSession);

    console.log(
      `[AgentSessionService] Session saved successfully for ${sessionId.slice(0, 8)}`,
    );
  }

  // Delete a session
  async deleteSession(
    directory: string,
    sessionId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const globalSessions = await this.getGlobalSessions();

      // Check if session exists
      if (!globalSessions.sessions[sessionId]) {
        return { success: false, error: `Session ${sessionId} not found` };
      }

      // Remove the session
      delete globalSessions.sessions[sessionId];

      // Clear active session if it was deleted
      if (globalSessions.activeSessionsByDirectory[directory] === sessionId) {
        delete globalSessions.activeSessionsByDirectory[directory];
      }

      await this.saveGlobalSessions(globalSessions);
      this.notifyWindows('agent-session-deleted', { directory, sessionId });

      return { success: true };
    } catch (error) {
      console.error('[AgentSessionService] Error deleting session:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred while deleting session',
      };
    }
  }

  // Clear all sessions for a directory (requires git repository information)
  async clearSessionsForDirectory(directory: string): Promise<void> {
    const globalSessions = await this.getGlobalSessions();

    // Get basic git info for the directory to find its git root
    let gitRoot: string | null = null;
    try {
      const gitInfo = await this.getBasicGitInfo(directory);
      gitRoot = gitInfo?.gitRoot || null;
    } catch (error) {
      console.log(
        `[AgentSessionService] Could not get git info for directory ${directory}:`,
        error,
      );
    }

    let sessionsToDelete: string[];

    if (gitRoot) {
      // Only remove sessions that belong to this git repository and have proper git info
      sessionsToDelete = Object.entries(globalSessions.sessions)
        .filter(([, session]) => session.basicGitInfo?.gitRoot === gitRoot)
        .map(([id]) => id);
      console.log(
        `[AgentSessionService] Clearing sessions for git root: ${gitRoot}, removing: ${sessionsToDelete.length} sessions`,
      );
    } else {
      // No git repository found - nothing to clear
      sessionsToDelete = [];
      console.log(
        `[AgentSessionService] No git repository found for directory: ${directory}, nothing to clear`,
      );
    }

    sessionsToDelete.forEach((id) => delete globalSessions.sessions[id]);

    // Clear active session for this directory
    delete globalSessions.activeSessionsByDirectory[directory];

    await this.saveGlobalSessions(globalSessions);
    this.notifyWindows('agent-sessions-cleared', { directory });
  }

  // Get all directories that have sessions (only returns git repository roots)
  async getAllDirectories(): Promise<string[]> {
    const globalSessions = await this.getGlobalSessions();

    // Get unique git roots from all sessions that have proper git info
    const directories = new Set<string>();
    Object.values(globalSessions.sessions).forEach((session) => {
      // Only include sessions with proper git repository information
      if (session.basicGitInfo?.gitRoot) {
        directories.add(session.basicGitInfo.gitRoot);
      }
    });

    return Array.from(directories);
  }

  // Get all sessions across all directories (grouped by git repository root, requires git info)
  async getAllSessions(): Promise<
    { directory: string; sessions: AgentSessionRecord[] }[]
  > {
    const globalSessions = await this.getGlobalSessions();

    // Group sessions by git repository root (only include sessions with proper git info)
    const sessionsByRepository = new Map<string, AgentSessionRecord[]>();

    Object.values(globalSessions.sessions).forEach((session) => {
      // Only include sessions with proper git repository information
      if (session.basicGitInfo?.gitRoot) {
        const groupKey = session.basicGitInfo.gitRoot;
        if (!sessionsByRepository.has(groupKey)) {
          sessionsByRepository.set(groupKey, []);
        }
        sessionsByRepository.get(groupKey)!.push(session);
      }
    });

    // Convert to array format
    const allSessions: { directory: string; sessions: AgentSessionRecord[] }[] =
      [];
    for (const [directory, sessions] of sessionsByRepository.entries()) {
      if (sessions.length > 0) {
        allSessions.push({ directory, sessions });
      }
    }

    return allSessions;
  }

  // Get lightweight session summaries across all directories (grouped by git repository root, requires git info)
  async getSessionSummaries(): Promise<
    { directory: string; summaries: SessionSummary[] }[]
  > {
    const globalSessions = await this.getGlobalSessions();

    // Group sessions by git repository root (only include sessions with proper git info)
    const sessionsByRepository = new Map<string, AgentSessionRecord[]>();

    Object.values(globalSessions.sessions).forEach((session) => {
      // Only include sessions with proper git repository information
      if (session.basicGitInfo?.gitRoot) {
        const groupKey = session.basicGitInfo.gitRoot;
        if (!sessionsByRepository.has(groupKey)) {
          sessionsByRepository.set(groupKey, []);
        }
        sessionsByRepository.get(groupKey)!.push(session);
      }
    });

    // Convert to summaries
    const allSummaries: { directory: string; summaries: SessionSummary[] }[] =
      [];

    for (const [directory, sessions] of sessionsByRepository.entries()) {
      if (sessions.length > 0) {
        const summaries: SessionSummary[] = sessions.map((session) => {
          console.log(
            `[AgentSessionService] Creating summary for session ${session.sessionId.slice(0, 8)}:`,
            {
              hasLastEvent: !!session.lastEvent,
              lastEventType: session.lastEvent?.type,
              lastEventData: session.lastEvent,
              hasLastToolActivity: !!session.lastToolActivity,
              lastToolActivityType: session.lastToolActivity?.type,
              lastEventTypeField: session.lastEventType,
              lastStopTime: session.lastStopTime,
              hasStopTime: !!session.lastStopTime,
            },
          );

          return {
            sessionId: session.sessionId,
            workingDirectory: session.workingDirectory,
            firstAccess: session.firstAccess,
            lastActivity: session.lastActivity,
            lastEventType: session.lastEventType,
            lastStopTime: session.lastStopTime,
            reviewedLastStop: session.reviewedLastStop,
            fileAccessCount: Object.keys(session.fileAccesses || {}).length,
            fileWriteCount: Object.keys(session.fileWrites || {}).length,
            toolCallCount: session.toolCalls?.length || 0,
            webAccessCount: session.webAccesses?.length || 0,
            customName:
              typeof session.metadata?.customName === 'string'
                ? session.metadata.customName
                : undefined,
            repositories: session.repositories?.map((repo) => ({
              root: repo.root,
              rootDisplay: repo.rootDisplay,
              fileCount: repo.fileCount,
            })),
            lastToolActivity: session.lastToolActivity,
            lastEvent: session.lastEvent,
          };
        });

        allSummaries.push({
          directory,
          summaries,
        });
      }
    }

    return allSummaries;
  }

  // Helper method to check and save git info if missing
  private async checkAndSaveGitInfoIfMissing(
    session: AgentSessionRecord,
    directory: string,
  ): Promise<AgentSessionRecord> {
    if (!session.basicGitInfo && session.workingDirectory) {
      console.log(
        `[AgentSessionService] Session ${session.sessionId} missing basicGitInfo, running lookup for directory: ${session.workingDirectory}`,
      );

      // Run the lookup and save the result
      const gitInfo = await this.getBasicGitInfo(session.workingDirectory);

      if (gitInfo) {
        console.log(
          `[AgentSessionService] Git info lookup successful for session ${session.sessionId} - saving to session`,
        );

        // Save to session
        session.basicGitInfo = gitInfo;

        // Update the session in the database
        await this.upsertSession(directory, session);
        console.log(
          `[AgentSessionService] Saved basicGitInfo to session ${session.sessionId}`,
        );
      } else {
        console.log(
          `[AgentSessionService] Git info lookup failed for session ${session.sessionId} in directory: ${session.workingDirectory}`,
        );
      }
    }
    return session;
  }

  // Add tool call
  async addToolCall(
    directory: string,
    sessionId: string,
    toolName: string,
    parameters: any,
    toolInput?: any,
    toolResponse?: any,
    metadata?: any,
  ): Promise<void> {
    const session = await this.getSession(directory, sessionId);
    if (!session) return;

    // Check and save git info if missing (saves to database)
    const updatedSession = await this.checkAndSaveGitInfoIfMissing(
      session,
      directory,
    );

    if (!updatedSession.toolCalls) {
      updatedSession.toolCalls = [];
    }

    const timestamp = Date.now();

    // Extract and normalize file path if this tool operates on files
    const filePath = this.extractFilePathFromTool(toolName, parameters);
    let normalizedPath: string | undefined;

    if (filePath) {
      const workingDirectory = metadata?.workingDirectory || directory;
      const resolved = await this.resolveAndNormalizePath(
        filePath,
        workingDirectory,
        updatedSession.basicGitInfo?.gitRoot,
      );
      normalizedPath = resolved.normalizedPath;
    }

    updatedSession.toolCalls.push({
      toolName,
      timestamp,
      parameters,
      toolInput,
      toolResponse,
      normalizedPath,
      metadata,
    });

    // Keep only the last 1000 tool calls to prevent unbounded growth
    if (updatedSession.toolCalls.length > 1000) {
      updatedSession.toolCalls = updatedSession.toolCalls.slice(-1000);
    }

    // Update lastToolActivity for Read, Edit, Write, MultiEdit tools
    const meaningfulTools = ['Read', 'Edit', 'Write', 'MultiEdit'];
    if (meaningfulTools.includes(toolName) && parameters?.file_path) {
      // Extract just the filename from the path
      const fileName = parameters.file_path.split('/').pop() || 'unknown';

      // Determine the activity type
      let activityType: 'read' | 'write' | 'edit';
      if (toolName === ToolName.READ) {
        activityType = 'read';
      } else if (toolName === ToolName.WRITE) {
        activityType = 'write';
      } else {
        activityType = 'edit';
      }

      // Update to the latest activity (DEPRECATED - keeping during migration)
      updatedSession.lastToolActivity = {
        type: activityType,
        fileName,
        filePath: parameters.file_path, // Include full path for map visualization
        timestamp,
      };

      // NEW: Update consolidated lastEvent field
      let eventActivityType: EventActivityType;
      if (toolName === ToolName.READ) {
        eventActivityType = EventActivityType.READ;
      } else if (toolName === ToolName.WRITE) {
        eventActivityType = EventActivityType.WRITE;
      } else {
        eventActivityType = EventActivityType.EDIT;
      }

      updatedSession.lastEvent = {
        type: eventActivityType,
        fileName,
        filePath: parameters.file_path,
        toolName,
        timestamp,
        metadata,
      };
    } else {
      // For non-file tools, just update with tool info
      updatedSession.lastEvent = {
        type: EventActivityType.TOOL,
        toolName,
        timestamp,
        metadata,
      };
    }

    updatedSession.lastActivity = timestamp;
    updatedSession.lastEventType = LastEventType.TOOL;
    await this.upsertSession(directory, updatedSession);
  }

  // Add stop event
  async addStopEvent(
    directory: string,
    sessionId: string,
    trigger: StopTrigger = StopTrigger.MANUAL,
    reason?: string,
    metadata?: any,
  ): Promise<void> {
    const session = await this.getSession(directory, sessionId);
    if (!session) return;

    if (!session.stopEvents) {
      session.stopEvents = [];
    }

    const stopTime = Date.now();

    const stopEvent = {
      timestamp: stopTime,
      trigger,
      reason,
      metadata,
      autoCommit: {
        status: AutoCommitStatus.PENDING,
        filesCommitted: [] as string[],
        commitHash: undefined,
        commitMessage: undefined,
        error: undefined,
      },
    };

    session.stopEvents.push(stopEvent);

    // Also update lastStopTime for backward compatibility
    session.lastStopTime = stopTime;
    session.reviewedLastStop = false;
    session.lastActivity = stopTime;
    session.lastEventType = LastEventType.STOP;

    // NOTE: Don't set lastEvent for stop events - use lastEventType/lastStopTime for that
    // lastEvent should only track meaningful file/tool operations

    // Save session first with pending status
    await this.upsertSession(directory, session);

    // Attempt auto-commit if enabled and git info is available
    // TEMPORARILY DISABLED: Auto-commit functionality is being fixed
    /*
    if (session.autoCommitEnabled && session.basicGitInfo?.gitRoot) {
      try {
        const commitResult = await this.performAutoCommit(session, stopEvent);
        
        // Update the stop event with commit result
        const updatedSession = await this.getSession(directory, sessionId);
        if (updatedSession && updatedSession.stopEvents) {
          const lastStopEvent = updatedSession.stopEvents[updatedSession.stopEvents.length - 1];
          if (lastStopEvent.timestamp === stopTime) {
            lastStopEvent.autoCommit = commitResult;
            await this.upsertSession(directory, updatedSession);
          }
        }
      } catch (error) {
        console.error('[AgentSessionService] Auto-commit failed:', error);
        
        // Update with error status
        const updatedSession = await this.getSession(directory, sessionId);
        if (updatedSession && updatedSession.stopEvents) {
          const lastStopEvent = updatedSession.stopEvents[updatedSession.stopEvents.length - 1];
          if (lastStopEvent.timestamp === stopTime) {
            lastStopEvent.autoCommit = {
              status: AutoCommitStatus.FAILED,
              error: error instanceof Error ? error.message : 'Unknown error',
              filesCommitted: [],
              commitHash: undefined,
              commitMessage: undefined
            };
            await this.upsertSession(directory, updatedSession);
          }
        }
      }
    } else {
      // No git info, mark as skipped
      const updatedSession = await this.getSession(directory, sessionId);
      if (updatedSession && updatedSession.stopEvents) {
        const lastStopEvent = updatedSession.stopEvents[updatedSession.stopEvents.length - 1];
        if (lastStopEvent.timestamp === stopTime) {
          lastStopEvent.autoCommit = {
            status: AutoCommitStatus.SKIPPED,
            error: 'No git repository information available',
            filesCommitted: [],
            commitHash: undefined,
            commitMessage: undefined
          };
          await this.upsertSession(directory, updatedSession);
        }
      }
    }
    */
  }

  // Watch for store changes
  watchStoreChanges(
    callback: (newValue: any, oldValue: any) => void,
  ): () => void {
    // Note: electron-store's onDidChange doesn't work well with nested paths
    // We'll implement our own change detection in the handlers
    return () => {}; // Return unsubscribe function
  }

  // Get basic git information for a directory (simple and reliable)
  async getBasicGitInfo(directory: string): Promise<{
    gitRoot: string;
    relativePath: string;
    githubOwner?: string;
    githubRepo?: string;
    remoteUrl?: string;
  } | null> {
    try {
      console.log(
        `🔍 GIT-DEBUG: getBasicGitInfo called with directory: "${directory}"`,
      );

      // Add directory existence check
      const fs = require('fs');
      if (!fs.existsSync(directory)) {
        console.log(`🔍 GIT-DEBUG: Directory does not exist: ${directory}`);
        return null;
      }

      const repoInfo = await this.gitService.getRepositoryInfo(directory);

      if (!repoInfo || !repoInfo.root) {
        console.log(
          `🔍 GIT-DEBUG: No git repository found for directory: ${directory}`,
        );
        return null;
      }

      console.log(
        `🔍 GIT-DEBUG: Git detection result - input: "${directory}" -> gitRoot: "${repoInfo.root}"`,
      );

      // Check if the result looks wrong (subdirectory instead of git root)
      if (
        repoInfo.root === directory &&
        (directory.includes('/electron-react') ||
          directory.includes('/code-city-landing'))
      ) {
        console.log(
          `🔍 GIT-DEBUG: WARNING - Git root equals input directory, might be wrong for: ${directory}`,
        );
      }

      // Extract GitHub info from the first remote (usually origin)
      const primaryRemote = repoInfo.remotes?.[0];

      const result = {
        gitRoot: repoInfo.root,
        relativePath: repoInfo.relativePath || '.',
        githubOwner: primaryRemote?.owner,
        githubRepo: primaryRemote?.repo,
        remoteUrl: primaryRemote?.url,
      };

      console.log(
        `[AgentSessionService] Git info lookup completed successfully`,
      );
      return result;
    } catch (error) {
      console.error(
        `[AgentSessionService] *** ERROR in getBasicGitInfo ***:`,
        error,
      );
      if (error instanceof Error) {
        console.error(`[AgentSessionService] Error stack:`, error.stack);
      }
      return null;
    }
  }

  // Update session with basic git info
  async updateBasicGitInfo(
    directory: string,
    sessionId: string,
  ): Promise<void> {
    const session = await this.getSession(directory, sessionId);
    if (!session) return;

    const gitInfo = await this.getBasicGitInfo(session.workingDirectory);
    if (gitInfo) {
      session.basicGitInfo = gitInfo;
      await this.upsertSession(directory, session);
      console.log(
        `[AgentSessionService] Updated basic git info for session ${sessionId}:`,
        gitInfo,
      );
    }
  }

  // Update session auto-commit enabled flag
  async updateAutoCommitEnabled(
    directory: string,
    sessionId: string,
    enabled: boolean,
  ): Promise<void> {
    const session = await this.getSession(directory, sessionId);
    if (!session) return;

    session.autoCommitEnabled = enabled;
    await this.upsertSession(directory, session);
    console.log(
      `[AgentSessionService] Updated auto-commit enabled for session ${sessionId}: ${enabled}`,
    );
  }

  // Populate git info for all sessions that don't have it (can be called during migration or maintenance)
  async populateGitInfoForExistingSessions(): Promise<{
    updated: number;
    failed: number;
    total: number;
  }> {
    const globalSessions = await this.getGlobalSessions();

    let updated = 0;
    let failed = 0;
    let total = 0;

    const sessionsToUpdate = Object.values(globalSessions.sessions).filter(
      (session) => !session.basicGitInfo,
    );
    total = sessionsToUpdate.length;

    console.log(
      `[AgentSessionService] Found ${total} sessions without git info, attempting to populate...`,
    );

    for (const session of sessionsToUpdate) {
      try {
        const gitInfo = await this.getBasicGitInfo(session.workingDirectory);
        if (gitInfo) {
          session.basicGitInfo = gitInfo;
          globalSessions.sessions[session.sessionId] = session;
          updated++;
          console.log(
            `[AgentSessionService] Updated git info for session ${session.sessionId}: ${gitInfo.gitRoot}`,
          );
        } else {
          failed++;
          console.log(
            `[AgentSessionService] No git info found for session ${session.sessionId} in ${session.workingDirectory}`,
          );
        }
      } catch (error) {
        failed++;
        console.error(
          `[AgentSessionService] Error updating git info for session ${session.sessionId}:`,
          error,
        );
      }
    }

    if (updated > 0) {
      await this.saveGlobalSessions(globalSessions);
      console.log(
        `[AgentSessionService] Updated git info for ${updated} sessions`,
      );
    }

    return { updated, failed, total };
  }

  // Notify all windows of changes
  private notifyWindows(event: string, data: any): void {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (!window.isDestroyed()) {
        window.webContents.send(event, data);
      }
    });
  }

  // Get session by ID (searches globally)
  async getSessionById(sessionId: string): Promise<AgentSessionRecord | null> {
    const globalSessions = await this.getGlobalSessions();
    return globalSessions.sessions[sessionId] || null;
  }

  // Get all commits for a session
  async getSessionCommits(sessionId: string): Promise<
    Array<{
      timestamp: number;
      commitHash?: string;
      commitMessage?: string;
      filesCommitted?: string[];
      status: AutoCommitStatus;
      error?: string;
    }>
  > {
    const session = await this.getSessionById(sessionId);
    if (!session || !session.stopEvents) {
      return [];
    }

    return session.stopEvents
      .filter((event) => event.autoCommit)
      .map((event) => ({
        timestamp: event.timestamp,
        commitHash: event.autoCommit?.commitHash,
        commitMessage: event.autoCommit?.commitMessage,
        filesCommitted: event.autoCommit?.filesCommitted,
        status: event.autoCommit?.status || AutoCommitStatus.SKIPPED,
        error: event.autoCommit?.error,
      }));
  }

  // Get commit for a specific stop event
  async getStopEventCommit(
    sessionId: string,
    stopTimestamp: number,
  ): Promise<{
    commitHash?: string;
    commitMessage?: string;
    filesCommitted?: string[];
    status: AutoCommitStatus;
    error?: string;
  } | null> {
    const session = await this.getSessionById(sessionId);
    if (!session || !session.stopEvents) {
      return null;
    }

    const stopEvent = session.stopEvents.find(
      (event) => event.timestamp === stopTimestamp,
    );
    if (!stopEvent || !stopEvent.autoCommit) {
      return null;
    }

    return {
      commitHash: stopEvent.autoCommit.commitHash,
      commitMessage: stopEvent.autoCommit.commitMessage,
      filesCommitted: stopEvent.autoCommit.filesCommitted,
      status: stopEvent.autoCommit.status,
      error: stopEvent.autoCommit.error,
    };
  }

  // Perform auto-commit for a stop event
  private async performAutoCommit(
    session: AgentSessionRecord,
    stopEvent: any,
  ): Promise<{
    status: Exclude<AutoCommitStatus, AutoCommitStatus.PENDING>;
    commitHash?: string;
    commitMessage?: string;
    filesCommitted?: string[];
    error?: string;
  }> {
    if (!session.basicGitInfo?.gitRoot) {
      return {
        status: AutoCommitStatus.SKIPPED,
        error: 'No git repository information',
      };
    }

    const { gitRoot } = session.basicGitInfo;

    try {
      // Get list of files that were written during this session
      const writtenFiles = Object.keys(session.fileWrites || {});

      if (writtenFiles.length === 0) {
        return {
          status: AutoCommitStatus.SKIPPED,
          error: 'No files were written during this session',
        };
      }

      // Check git status to see which files have changes
      const gitStatus = await this.gitService.getGitStatus(gitRoot);

      // Filter written files to only include those with actual changes
      const filesToCommit = writtenFiles.filter((file) => {
        const relativePath = file.startsWith(gitRoot)
          ? file.substring(gitRoot.length + 1)
          : file;
        return (
          gitStatus.unstaged.includes(relativePath) ||
          gitStatus.staged.includes(relativePath)
        );
      });

      if (filesToCommit.length === 0) {
        return {
          status: AutoCommitStatus.SKIPPED,
          error: 'No written files have uncommitted changes',
        };
      }

      // Stage the files
      const relativeFiles = filesToCommit.map((file) =>
        file.startsWith(gitRoot) ? file.substring(gitRoot.length + 1) : file,
      );
      await this.gitService.stageFiles(gitRoot, relativeFiles);

      // Generate commit message
      const commitMessage = this.generateCommitMessage(
        session,
        filesToCommit,
        stopEvent,
      );

      // Create the commit
      const commitHash = await this.gitService.createCommit(
        gitRoot,
        commitMessage,
      );

      return {
        status: AutoCommitStatus.SUCCESS,
        commitHash,
        commitMessage,
        filesCommitted: filesToCommit,
      };
    } catch (error) {
      console.error('[AgentSessionService] Error during auto-commit:', error);
      return {
        status: AutoCommitStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Generate commit message for auto-commit
  private generateCommitMessage(
    session: AgentSessionRecord,
    files: string[],
    stopEvent: any,
  ): string {
    const fileCount = files.length;
    const fileList = files
      .map((f) => path.basename(f))
      .slice(0, 3)
      .join(', ');
    const sessionDuration = Math.round(
      (stopEvent.timestamp - session.firstAccess) / 1000 / 60,
    ); // in minutes

    let message = `Auto-commit: ${fileCount} file${fileCount > 1 ? 's' : ''} modified`;

    if (fileCount <= 3) {
      message = `Auto-commit: Modified ${fileList}`;
    } else {
      message = `Auto-commit: Modified ${fileCount} files including ${fileList}`;
    }

    // Add session metadata
    message += `\n\nSession: ${session.sessionId}`;
    message += `\nDuration: ${sessionDuration} minutes`;

    if (stopEvent.reason) {
      message += `\nStop reason: ${stopEvent.reason}`;
    }

    return message;
  }

  // Debug methods for git repository detection
  clearGitRepositoryCache(): void {
    console.log('[AgentSessionService] Clearing git repository cache...');
    this.gitService.clearRepositoryCache();
  }

  cleanupExpiredGitCache(): void {
    console.log(
      '[AgentSessionService] Cleaning up expired git cache entries...',
    );
    this.gitService.cleanupExpiredCacheEntries();
  }

  getGitRepositoryCacheInfo(): { size: number; entries: string[] } {
    return this.gitService.getCacheInfo();
  }

  // Test git repository detection for a directory with fresh cache
  async testGitRepositoryDetectionFresh(directory: string): Promise<{
    success: boolean;
    error?: string;
    gitRoot?: string;
    relativePath?: string;
    remotes?: any[];
    cacheInfo?: { size: number; entries: string[] };
  }> {
    console.log(
      `[AgentSessionService] Testing git repository detection with fresh cache for: ${directory}`,
    );

    // Clear cache first to ensure fresh test
    this.clearGitRepositoryCache();

    return this.testGitRepositoryDetection(directory);
  }

  // Test git repository detection for a directory
  async testGitRepositoryDetection(directory: string): Promise<{
    success: boolean;
    error?: string;
    gitRoot?: string;
    relativePath?: string;
    remotes?: any[];
    cacheInfo?: { size: number; entries: string[] };
  }> {
    try {
      console.log(
        `[AgentSessionService] Testing git repository detection for: ${directory}`,
      );

      const cacheInfo = this.getGitRepositoryCacheInfo();
      console.log(`[AgentSessionService] Cache info before test:`, cacheInfo);

      const result = await this.getBasicGitInfo(directory);

      if (result) {
        return {
          success: true,
          gitRoot: result.gitRoot,
          relativePath: result.relativePath,
          remotes: [], // We don't expose full remotes in basic info
          cacheInfo: this.getGitRepositoryCacheInfo(),
        };
      }
      return {
        success: false,
        error: 'No git repository information found',
        cacheInfo: this.getGitRepositoryCacheInfo(),
      };
    } catch (error) {
      console.error(
        '[AgentSessionService] Error in git repository detection test:',
        error,
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheInfo: this.getGitRepositoryCacheInfo(),
      };
    }
  }

  // Get uncommitted changes for segments without commits
  async getUncommittedChangesForSegments(sessionId: string): Promise<{
    segments: Array<{
      timestamp: number;
      hasCommit: boolean;
    }>;
    changes: {
      created: string[];
      modified: string[];
      deleted: string[];
      renamed: Array<{ from: string; to: string }>;
      stats: { additions: number; deletions: number };
    } | null;
    filesFromSegments: string[];
  }> {
    const session = await this.getSessionById(sessionId);
    if (!session || !session.stopEvents || !session.basicGitInfo?.gitRoot) {
      return { segments: [], changes: null, filesFromSegments: [] };
    }

    // Get all segments without commits
    const segmentsWithoutCommits = session.stopEvents.filter(
      (event) =>
        !event.autoCommit ||
        event.autoCommit.status !== AutoCommitStatus.SUCCESS,
    );

    if (segmentsWithoutCommits.length === 0) {
      return { segments: [], changes: null, filesFromSegments: [] };
    }

    // Collect all files written in these segments
    const filesFromSegments = new Set<string>();

    // For each segment, find files written between this stop and the previous stop
    for (let i = 0; i < session.stopEvents.length; i++) {
      const currentStop = session.stopEvents[i];

      // Skip if this segment already has a commit
      if (currentStop.autoCommit?.status === AutoCommitStatus.SUCCESS) continue;

      const previousStop = i > 0 ? session.stopEvents[i - 1] : null;
      const startTime = previousStop
        ? previousStop.timestamp
        : session.firstAccess;
      const endTime = currentStop.timestamp;

      // Find files written in this time range
      Object.entries(session.fileWrites || {}).forEach(([filePath, writes]) => {
        const hasWriteInRange = writes.some(
          (write) => write.timestamp >= startTime && write.timestamp <= endTime,
        );
        if (hasWriteInRange) {
          filesFromSegments.add(filePath);
        }
      });
    }

    const filesArray = Array.from(filesFromSegments);

    try {
      // Get detailed changes for these files
      const changes = await this.gitService.getDetailedChanges(
        session.basicGitInfo.gitRoot,
        filesArray,
      );

      return {
        segments: segmentsWithoutCommits.map((s) => ({
          timestamp: s.timestamp,
          hasCommit: s.autoCommit?.status === AutoCommitStatus.SUCCESS,
        })),
        changes,
        filesFromSegments: filesArray,
      };
    } catch (error) {
      console.error(
        '[AgentSessionService] Failed to get uncommitted changes:',
        error,
      );
      return {
        segments: segmentsWithoutCommits.map((s) => ({
          timestamp: s.timestamp,
          hasCommit: false,
        })),
        changes: null,
        filesFromSegments: filesArray,
      };
    }
  }

  // Perform manual commit for multiple segments
  async performManualCommit(
    sessionId: string,
    message: string,
    segmentTimestamps?: number[],
  ): Promise<{
    success: boolean;
    commitHash?: string;
    error?: string;
    updatedSegments?: number[];
  }> {
    const session = await this.getSessionById(sessionId);
    if (!session || !session.basicGitInfo?.gitRoot) {
      return { success: false, error: 'Session or git info not found' };
    }

    try {
      // Get uncommitted changes info
      const { filesFromSegments, segments } =
        await this.getUncommittedChangesForSegments(sessionId);

      if (filesFromSegments.length === 0) {
        return { success: false, error: 'No files to commit' };
      }

      // Stage the files
      const relativeFiles = filesFromSegments.map((file) =>
        file.startsWith(session.basicGitInfo!.gitRoot)
          ? file.substring(session.basicGitInfo!.gitRoot.length + 1)
          : file,
      );
      await this.gitService.stageFiles(
        session.basicGitInfo.gitRoot,
        relativeFiles,
      );

      // Create the commit
      const commitHash = await this.gitService.createCommit(
        session.basicGitInfo.gitRoot,
        message,
      );

      // Update all relevant segments with the commit info
      const timestampsToUpdate =
        segmentTimestamps || segments.map((s) => s.timestamp);

      if (session.stopEvents) {
        session.stopEvents.forEach((event) => {
          if (timestampsToUpdate.includes(event.timestamp)) {
            event.autoCommit = {
              status: AutoCommitStatus.SUCCESS,
              commitHash,
              commitMessage: message,
              filesCommitted: filesFromSegments,
              error: undefined,
            };
          }
        });

        // Save the updated session
        await this.upsertSession(session.workingDirectory, session);
      }

      return {
        success: true,
        commitHash,
        updatedSegments: timestampsToUpdate,
      };
    } catch (error) {
      console.error('[AgentSessionService] Manual commit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Cleanup method to be called when service is destroyed
  destroy(): void {
    this.gitService.destroy();
  }
}

export const agentSessionService = AgentSessionService.getInstance();
