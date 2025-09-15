import React from 'react';
import type { HighlightLayer } from "@principal-ai/code-city-react";
import { EnhancedUIAgentSessionData } from '../../../types/session.types';
import { FileTreeSourceService } from '../../../services/FileTreeSourceService';
import { SessionCardData } from './AgentSessionCard';
import type { Repository } from '../../../../shared/types/repository.types';
import { FileTreeSource } from '../../../types/file-tree-source';
interface AgentSessionsTabProps {
    repositoryPath: string;
    localClonePaths?: string[];
    selectedCloneAgentSessionIds?: Set<string>;
    selectedAgentSessionIds: Set<string>;
    onSessionSelect?: (sessionId: string) => void;
    onSessionUnselect?: (sessionId: string) => void;
    onLayersGenerated?: (sessionId: string, readLayer: HighlightLayer | null, writeLayer: HighlightLayer | null) => void;
    onOpenTerminal?: (sessionId: string, sessionName?: string) => void;
    onShowContext?: (sessionId: string) => void;
    onSessionDetailSelect?: (sessionId: string, cardData: SessionCardData) => void;
    onSessionMapVisibilityChange?: (sessionId: string | null) => void;
    allAgentSessions?: EnhancedUIAgentSessionData[];
    fileTreeSourceService?: FileTreeSourceService;
    sourceId?: string;
    repository?: Repository;
    fileTreeSources?: FileTreeSource[];
    onSessionCardUpdate?: (sessionId: string, cardData: SessionCardData) => void;
}
export declare const AgentSessionsTab: React.FC<AgentSessionsTabProps>;
export {};
//# sourceMappingURL=AgentSessionsTab.d.ts.map