import type { NormalizedAgentSessionEvent } from "@principal-ai/agent-monitoring";
export interface SessionSegment {
    id: string;
    startTime: number;
    endTime: number;
    events: NormalizedAgentSessionEvent[];
    fileAccesses: Map<string, number>;
    fileWrites: Map<string, number>;
    toolCalls: Map<string, number>;
    webAccesses: string[];
    primaryActivity?: 'file-reading' | 'file-writing' | 'web-research' | 'tool-usage' | 'mixed';
    description?: string;
}
export interface SessionView {
    sessionId: string;
    provider: string;
    workingDirectory: string;
    normalizedWorkingDirectory?: string;
    startTime: number;
    endTime: number;
    duration: number;
    segments: SessionSegment[];
    totalEvents: number;
    uniqueFilesAccessed: number;
    uniqueFilesModified: number;
    totalToolCalls: number;
    totalWebAccesses: number;
    repositoriesAccessed?: Array<{
        remoteUrl: string;
        gitRoot: string;
    }>;
}
//# sourceMappingURL=sessionViewTypes.d.ts.map