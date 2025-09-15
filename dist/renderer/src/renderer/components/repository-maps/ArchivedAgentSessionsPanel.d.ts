import React from 'react';
import { ArchivedSessionData } from '../../types/session.types';
export type ArchivedAgentSessionBrief = ArchivedSessionData;
interface ArchivedAgentSessionsPanelProps {
    repositoryPath: string;
    repositoryName: string;
    localClonePaths?: string[];
    onSessionSelect: (session: ArchivedSessionData, directory: string) => void;
    onSessionUnselect: () => void;
    selectedSessionId?: string;
    sessionLayerFilters: Map<string, 'current' | 'recent' | 'all'>;
    onSessionLayerFilterChange: (sessionId: string, filter: 'current' | 'recent' | 'all') => void;
    onLayersGenerated?: (sessionId: string, readLayer: any, writeLayer: any) => void;
    selectedSessionIds?: Set<string>;
    onMultiSessionSelect?: (sessionId: string) => void;
}
export declare const ArchivedAgentSessionsPanel: React.FC<ArchivedAgentSessionsPanelProps>;
export {};
//# sourceMappingURL=ArchivedAgentSessionsPanel.d.ts.map