import { LastEventType, EventActivityType } from '../../../../shared/sessionEnums';
import { AgentSessionRecord } from '../../../../shared/sessionTypes';
export interface SessionSummary {
    sessionId: string;
    workingDirectory: string;
    firstAccess: number;
    lastActivity: number;
    lastEventType?: LastEventType;
    lastEvent?: {
        type: EventActivityType;
        fileName?: string;
        filePath?: string;
        toolName?: string;
        timestamp: number;
        metadata?: any;
    };
    lastStopTime?: number;
    reviewedLastStop: boolean;
    fileAccessCount: number;
    fileWriteCount: number;
    toolCallCount: number;
    webAccessCount: number;
    customName?: string;
    repositories?: Array<{
        root: string;
        rootDisplay?: string;
        fileCount: number;
    }>;
}
export interface DirectorySessionsResult {
    sessions: AgentSessionRecord[];
    activeSessionId: string | null;
}
//# sourceMappingURL=session.types.d.ts.map