import React from 'react';
import { PackageLayer } from "@principal-ai/codebase-composition";
import { FileTreeCacheService } from '../../../services/FileTreeCacheService';
import { FileTreeSource } from '../../../types/file-tree-source';
interface RepoSourceArchitecturePanelSimpleProps {
    source: FileTreeSource;
    cacheService: FileTreeCacheService;
    packageLayers?: PackageLayer[] | null;
    onError?: (error: string) => void;
    onPackageLayersChanged?: (packageLayers: PackageLayer[] | null) => void;
    onPackageAnalysisStart?: (packagePath: string, packageName: string) => void;
    onPackageAnalysisEnd?: () => void;
    onPackageSelected?: (packagePath: string, packageName: string) => void;
    onPackageDeselected?: () => void;
}
/**
 * Dependencies panel for repository source
 * Analyzes package dependencies for updates, vulnerabilities, and license compliance
 * Used in Explore view to help maintain healthy dependencies
 */
export declare const RepoSourceArchitecturePanelSimple: React.FC<RepoSourceArchitecturePanelSimpleProps>;
export {};
//# sourceMappingURL=RepoSourceArchitecturePanelSimple.d.ts.map