import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import type { Repository } from '../../../shared/types/repository.types';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import { EnhancedUIAgentSessionData } from '../../types/session.types';
interface LocalDevelopmentViewProps {
    repository: Repository;
    localClone: {
        path: string;
        currentBranch?: string;
    };
    selectedAgentSessionIds?: Set<string>;
    selectedAgentSessions?: EnhancedUIAgentSessionData[];
    allAgentSessions?: EnhancedUIAgentSessionData[];
    onAgentSessionSelect?: (session: EnhancedUIAgentSessionData) => void;
    onSessionUpdate?: (sessionId: string, updates: Partial<EnhancedUIAgentSessionData>) => void;
    onSessionRefresh?: (sessionId: string) => void;
    searchQuery?: string;
    fileTree?: FileTree | null;
    cityData?: CityData | null;
    activeFileTreeSource?: FileTreeSource | null;
    fileTreeSourceService?: FileTreeSourceService;
    cacheService?: FileTreeCacheService;
    treeStats?: FileTreeStats | null;
    a24zNotes?: A24zNote[];
    fileColorHighlightLayers?: HighlightLayer[];
    onRefresh?: () => void;
}
/**
 * Local Development View - Uses source-based architecture
 * Manages its own data loading through services
 */
export declare const LocalDevelopmentView: React.FC<LocalDevelopmentViewProps>;
export {};
//# sourceMappingURL=LocalDevelopmentView.d.ts.map