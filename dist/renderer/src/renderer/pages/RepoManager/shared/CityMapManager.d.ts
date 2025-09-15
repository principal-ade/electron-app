import React, { ReactNode } from 'react';
import type { CityData } from "@principal-ai/code-city-react";
import { FileTree } from "@principal-ai/repository-abstraction";
import { FileTreeSource } from '../../../types/file-tree-source';
/**
 * View modes that affect how the city and badges are displayed
 */
export type CityViewMode = 'explore' | 'develop' | 'maintain';
/**
 * Props for the CityMapManager component
 */
export interface CityMapManagerProps {
    fileTree: FileTree | null;
    activeSource: FileTreeSource | null;
    gitEnabled?: boolean;
    headTree?: FileTree | null;
    hasNoCommits?: boolean;
    viewMode: CityViewMode;
    showWorkingTree?: boolean;
    showHeadTree?: boolean;
    onToggleWorkingTree?: (show: boolean) => void;
    onToggleHeadTree?: (show: boolean) => void;
    renderCustomBadges?: () => ReactNode;
    children: (props: {
        cityData: CityData | null;
        sourceBadges: ReactNode;
        isBuilding: boolean;
    }) => ReactNode;
}
/**
 * Centralized component for managing city data building and source badges
 * across different repository views (explore, develop, maintain)
 */
export declare const CityMapManager: React.FC<CityMapManagerProps>;
//# sourceMappingURL=CityMapManager.d.ts.map