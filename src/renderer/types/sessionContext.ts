export interface SessionContext {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  workingDirectory: string;

  // Core context from session
  summary: {
    taskType?: string;
    intent?: string;
    actionsSummary?: string;
    technologies: string[];
    affectedPackages: string[];
  };

  // File context
  files: {
    accessed: string[];
    modified: string[];
    created: string[];
  };

  // Optional preserved content
  preservedContent?: {
    analysis?: string; // Raw markdown from analysis
    notes?: string; // User notes
    metadata?: Record<string, any>; // Custom metadata
  };

  // Source session info
  sourceSession?: {
    sessionId: string;
    firstAccess: number;
    lastActivity: number;
  };

  // Tags for organization
  tags?: string[];
}

export interface SessionContextStore {
  contexts: SessionContext[];
  lastUpdated: number;
}

// Helper type for creating context from session
export interface CreateContextOptions {
  session: import('../../main/services/store').AgentSessionRecord;
  name?: string;
  description?: string;
  notes?: string;
  tags?: string[];
}
