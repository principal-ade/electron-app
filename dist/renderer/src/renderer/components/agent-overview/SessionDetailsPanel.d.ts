import React from 'react';
import type { AgentSessionRecord } from '../../../shared/sessionTypes';
interface SessionDetailsPanelProps {
    sessionId: string;
    directory: string;
    initialSession?: AgentSessionRecord;
    viewMode: 'files' | 'tools' | 'timeline';
    setViewMode: (mode: 'files' | 'tools' | 'timeline') => void;
    knipAnalysis?: any;
    setKnipAnalysis?: (analysis: any) => void;
    runningKnip?: boolean;
    setRunningKnip?: (running: boolean) => void;
    analyzingRepos?: boolean;
    setAnalyzingRepos?: (analyzing: boolean) => void;
    onSessionDeleted?: () => void;
}
export declare const SessionDetailsPanel: React.FC<SessionDetailsPanelProps>;
export {};
//# sourceMappingURL=SessionDetailsPanel.d.ts.map