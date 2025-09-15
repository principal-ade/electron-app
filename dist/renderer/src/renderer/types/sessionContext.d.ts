export interface SessionContext {
    id: string;
    name: string;
    description?: string;
    createdAt: number;
    updatedAt: number;
    workingDirectory: string;
    summary: {
        taskType?: string;
        intent?: string;
        actionsSummary?: string;
        technologies: string[];
        affectedPackages: string[];
    };
    files: {
        accessed: string[];
        modified: string[];
        created: string[];
    };
    preservedContent?: {
        analysis?: string;
        notes?: string;
        metadata?: Record<string, any>;
    };
    sourceSession?: {
        sessionId: string;
        firstAccess: number;
        lastActivity: number;
    };
    tags?: string[];
}
export interface SessionContextStore {
    contexts: SessionContext[];
    lastUpdated: number;
}
export interface CreateContextOptions {
    session: import('../../main/services/store').AgentSessionRecord;
    name?: string;
    description?: string;
    notes?: string;
    tags?: string[];
}
//# sourceMappingURL=sessionContext.d.ts.map