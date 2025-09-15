import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
import { LocalSearchResult } from '../../../services/LocalSearchService';
export interface DirectoryFilter {
    id: string;
    path: string;
    mode: 'include' | 'exclude';
}
interface LocalSearchPanelProps {
    fileSystemTree: FileTree;
    baseDirectory: string;
    onFileSelect: (filePath: string, lineNumbers?: number[], searchQuery?: string) => void;
    selectedFile?: string | null;
    onDirectoryFilterChange?: (filter: string) => void;
    onDirectoryFiltersChange?: (filters: DirectoryFilter[]) => void;
    onSearchResultsChange?: (results: LocalSearchResult[]) => void;
    onSearchQueryChange?: (query: string) => void;
    onSearchResultHover?: (filePath: string | null) => void;
    className?: string;
    headerExtra?: React.ReactNode;
    onOpenInEditor?: (filePath: string) => void;
    selectedEditor?: string;
}
export declare const LocalSearchPanel: React.FC<LocalSearchPanelProps>;
export {};
//# sourceMappingURL=LocalSearchPanel.d.ts.map