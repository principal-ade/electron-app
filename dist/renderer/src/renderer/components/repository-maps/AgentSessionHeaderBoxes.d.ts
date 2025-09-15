import React from 'react';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
interface AgentSessionHeaderBoxesProps {
    repositoryPath: string;
    localClonePaths?: string[];
    onSessionSelect?: (session: EnhancedUIAgentSessionData) => void;
    selectedSessionIds?: Set<string>;
    maxVisible?: number;
    agentSessions?: EnhancedUIAgentSessionData[];
    onStartNewSession?: () => void;
}
export declare const AgentSessionHeaderBoxes: React.FC<AgentSessionHeaderBoxesProps>;
export {};
//# sourceMappingURL=AgentSessionHeaderBoxes.d.ts.map