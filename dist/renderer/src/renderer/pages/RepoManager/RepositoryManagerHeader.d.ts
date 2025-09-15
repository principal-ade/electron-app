import React from 'react';
import type { Repository } from '../../../shared/types/repository.types';
import { type RepositoryMode } from './shared/ModeSelector';
import type { FileTreeSource, FileTreeStats } from '../../types/file-tree-source';
import type { PackageLayer } from "@principal-ai/codebase-composition";
interface RepositoryManagerHeaderProps {
    repository: Repository;
    ghOwner?: string;
    ghRepo?: string;
    mode?: RepositoryMode;
    onModeChange?: (mode: RepositoryMode) => void;
    onSourceSelect?: (source: FileTreeSource) => void;
    selectedSource?: FileTreeSource | null;
    fileTreeStats?: FileTreeStats | null;
    packageLayers?: PackageLayer[] | null;
    filterLayers?: any[] | null;
}
export declare const RepositoryManagerHeader: React.FC<RepositoryManagerHeaderProps>;
export {};
//# sourceMappingURL=RepositoryManagerHeader.d.ts.map