import React from 'react';
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import type { FileTree } from "@principal-ai/repository-abstraction";
import type { Repository } from '../../../shared/types/repository.types';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
interface RepositoryExplorationViewProps {
    repository: Repository;
    remoteData: {
        owner: string;
        repo: string;
        defaultBranch: string;
    };
    searchQuery?: string;
    fileTree?: FileTree | null;
    cityData?: CityData | null;
    activeFileTreeSource?: FileTreeSource | null;
    fileTreeSourceService?: FileTreeSourceService;
    cacheService?: FileTreeCacheService;
    cityDataCache?: unknown;
    treeStats?: FileTreeStats | null;
    a24zNotes?: A24zNote[];
    fileColorHighlightLayers?: HighlightLayer[];
    onFileTreeLoaded?: (fileTree: FileTree | null) => void;
}
export declare const RepositoryExplorationView: React.FC<RepositoryExplorationViewProps>;
export {};
//# sourceMappingURL=RepositoryExplorationView.d.ts.map