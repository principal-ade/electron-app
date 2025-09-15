import React from 'react';
import type { CityData, HighlightLayer } from "@principal-ai/code-city-react";
import type { FileTree } from "@principal-ai/repository-abstraction";
import { PackageLayer } from "@principal-ai/codebase-composition";
import type { Repository } from '../../../shared/types/repository.types';
import type { A24zNote } from '../../../shared/main-process-api-interfaces/A24zAPI';
import { FileTreeSourceService } from '../../services/FileTreeSourceService';
import { FileTreeCacheService } from '../../services/FileTreeCacheService';
import { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
interface RepositoryMaintenanceViewProps {
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
    packageLayers?: PackageLayer[] | null;
    onPackageLayersChange?: (layers: PackageLayer[] | null) => void;
    fileColorHighlightLayers?: HighlightLayer[];
    onFileTreeLoaded?: (fileTree: FileTree | null) => void;
}
export declare const RepositoryMaintenanceView: React.FC<RepositoryMaintenanceViewProps>;
export {};
//# sourceMappingURL=RepositoryMaintenanceView.d.ts.map