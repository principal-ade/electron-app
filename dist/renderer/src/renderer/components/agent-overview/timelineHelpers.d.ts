import type { AgentSessionRecord } from '../../../shared/sessionTypes';
import { SessionEventType } from '../../../shared/sessionEnums';
export declare const createTimelineEvents: (session: AgentSessionRecord, options?: {
    limit?: number;
    skipNormalization?: boolean;
}) => ({
    id: string;
    type: SessionEventType.GROUPED;
    timestamp: number;
    data: {
        events: any;
        filePath: string | undefined;
    };
} | {
    id: string;
    type: SessionEventType;
    timestamp: number;
    data: {
        file: string | undefined;
        normalizedPath: string | undefined;
        toolName: string | undefined;
        write: {
            operation: string;
        } | undefined;
        metadata: Record<string, unknown> | undefined;
        parameters: unknown;
        events?: undefined;
        filePath?: undefined;
    };
})[];
export declare const segmentEventsByStops: (session: AgentSessionRecord) => {
    startTime: number;
    endTime: number | null;
    events: ({
        id: string;
        type: SessionEventType.GROUPED;
        timestamp: number;
        data: {
            events: any;
            filePath: string | undefined;
        };
    } | {
        id: string;
        type: SessionEventType;
        timestamp: number;
        data: {
            file: string | undefined;
            normalizedPath: string | undefined;
            toolName: string | undefined;
            write: {
                operation: string;
            } | undefined;
            metadata: Record<string, unknown> | undefined;
            parameters: unknown;
            events?: undefined;
            filePath?: undefined;
        };
    })[];
    isReviewed: boolean;
    segmentNumber: number;
}[];
export declare const getAgentColorBySessionId: (sessionId: string) => {
    primary: string;
    secondary: string;
};
export declare const processEventsWithAgentColors: (events: Array<{
    event: any;
    filePath: string;
    normalizedPath: string;
    tool: string;
}>, agentSessionId: string) => {
    event: any;
    filePath: string;
    normalizedPath: string;
    tool: string;
}[];
//# sourceMappingURL=timelineHelpers.d.ts.map