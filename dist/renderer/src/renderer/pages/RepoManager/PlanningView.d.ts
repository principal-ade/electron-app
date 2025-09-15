import React from 'react';
import type { Repository } from '../../../shared/types/repository.types';
import { PlanningLeftTabType } from '../../../shared/types/userPreferences.types';
import { FileTree } from "@principal-ai/repository-abstraction";
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeSource } from '../../types/file-tree-source';
import { SupportedAgent } from "@principal-ai/agent-monitoring";
interface PlanningViewProps {
    repository: Repository;
    localClone: {
        path: string;
        currentBranch?: string;
    };
    onRefresh?: () => void;
    agentsWithMCP?: SupportedAgent[];
    loadingAgentMCPStatus?: boolean;
    fileTree?: FileTree | null;
    activeFileTreeSource?: FileTreeSource | null;
    fileTreeSourceService?: FileTreeSourceService;
    cacheService?: FileTreeCacheService;
    uiState?: {
        viewMode?: 'slides' | 'document';
        showSegmented?: boolean;
        showEditor?: boolean;
        activeLeftTab?: Exclude<PlanningLeftTabType, 'storage'>;
    };
    onUIStateChange?: (state: {
        viewMode?: 'slides' | 'document';
        showSegmented?: boolean;
        showEditor?: boolean;
        activeLeftTab?: 'terminal' | 'search' | 'editor';
    }) => void;
}
export declare const PlanningView: React.FC<PlanningViewProps>;
export {};
//# sourceMappingURL=PlanningView.d.ts.map