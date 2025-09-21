import {
  SessionContext,
  SessionContextStore,
  CreateContextOptions,
} from '../types/sessionContext';
import { AgentSessionRecord } from '../../shared/sessionTypes';
import { StoreService } from '../main-process-api/StoreService';

class SessionContextService {
  private readonly STORAGE_KEY = 'session-contexts';

  // Get all contexts for a directory
  async getContextsForDirectory(directory: string): Promise<SessionContext[]> {
    try {
      const result = await StoreService.get(
        `${this.STORAGE_KEY}:${directory}`,
      );
      const store = result as SessionContextStore | undefined;
      return store?.contexts || [];
    } catch (error) {
      console.error('Error fetching session contexts:', error);
      return [];
    }
  }

  // Save a new context or update existing one
  async saveContext(directory: string, context: SessionContext): Promise<void> {
    const contexts = await this.getContextsForDirectory(directory);
    const existingIndex = contexts.findIndex((c) => c.id === context.id);

    if (existingIndex >= 0) {
      contexts[existingIndex] = { ...context, updatedAt: Date.now() };
    } else {
      contexts.push(context);
    }

    const store: SessionContextStore = {
      contexts,
      lastUpdated: Date.now(),
    };

    await StoreService.set(
      `${this.STORAGE_KEY}:${directory}`,
      store,
    );
  }

  // Delete a context
  async deleteContext(directory: string, contextId: string): Promise<void> {
    const contexts = await this.getContextsForDirectory(directory);
    const filtered = contexts.filter((c) => c.id !== contextId);

    const store: SessionContextStore = {
      contexts: filtered,
      lastUpdated: Date.now(),
    };

    await StoreService.set(
      `${this.STORAGE_KEY}:${directory}`,
      store,
    );
  }

  // Create context from session
  createContextFromSession(options: CreateContextOptions): SessionContext {
    const { session, name, description, notes, tags } = options;

    // Extract file operations
    const accessedFiles = Object.keys(session.fileAccesses || {});
    const modifiedFiles = Object.keys(session.fileWrites || {});

    // Determine created files (files that were written but not previously accessed)
    const createdFiles = modifiedFiles.filter(
      (file) => !accessedFiles.includes(file),
    );

    // Generate default name if not provided
    const contextName = name || this.generateContextName(session);

    const context: SessionContext = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: contextName,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      workingDirectory: session.workingDirectory,

      summary: {
        // Analysis fields removed - deprecated feature
        taskType: undefined,
        intent: undefined,
        actionsSummary: undefined,
        technologies: [],
        affectedPackages: [],
      },

      files: {
        accessed: accessedFiles,
        modified: modifiedFiles,
        created: createdFiles,
      },

      preservedContent: {
        // analysis removed - deprecated feature
        notes,
        metadata: session.metadata,
      },

      sourceSession: {
        sessionId: session.sessionId,
        firstAccess: session.firstAccess,
        lastActivity: session.lastActivity,
      },

      tags,
    };

    return context;
  }

  // Generate a default name for the context
  private generateContextName(session: AgentSessionRecord): string {
    // Analysis removed - deprecated feature
    const fileCount =
      Object.keys(session.fileAccesses || {}).length +
      Object.keys(session.fileWrites || {}).length;

    return `Session ${session.sessionId.substring(0, 8)} - ${fileCount} files`;
  }

  // Search contexts
  async searchContexts(
    directory: string,
    query: string,
  ): Promise<SessionContext[]> {
    const contexts = await this.getContextsForDirectory(directory);
    const lowerQuery = query.toLowerCase();

    return contexts.filter(
      (context) =>
        context.name.toLowerCase().includes(lowerQuery) ||
        context.description?.toLowerCase().includes(lowerQuery) ||
        context.summary.taskType?.toLowerCase().includes(lowerQuery) ||
        context.summary.intent?.toLowerCase().includes(lowerQuery) ||
        context.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
    );
  }

  // Get contexts by tags
  async getContextsByTags(
    directory: string,
    tags: string[],
  ): Promise<SessionContext[]> {
    const contexts = await this.getContextsForDirectory(directory);

    return contexts.filter((context) =>
      tags.some((tag) => context.tags?.includes(tag)),
    );
  }
}

export const sessionContextService = new SessionContextService();
