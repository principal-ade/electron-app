import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
import { FileTreeSource } from '../../types/file-tree-source';
import { ContentProvider } from '../../services/ContentProviders';
interface SearchTabProps {
    fileTrees: Map<string, FileTree>;
    activeFileTreeSource: FileTreeSource | null;
    contentProvider?: ContentProvider;
    showEditorSelector?: boolean;
    onFileSelect?: (filePath: string, lineNumbers?: number[], searchQuery?: string) => void;
    selectedFile?: string | null;
    onSearchResultsChange?: (results: string[]) => void;
    onSearchResultHover?: (filePath: string | null) => void;
}
export declare const SearchTab: React.FC<SearchTabProps>;
export {};
//# sourceMappingURL=SearchTab.d.ts.map