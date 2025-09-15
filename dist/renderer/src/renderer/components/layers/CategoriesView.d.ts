import React from 'react';
interface FileTypeInfo {
    extension: string;
    count: number;
    color: string;
    icon: string;
    name: string;
    category?: string;
}
interface CategoriesViewProps {
    fileTypeStats: FileTypeInfo[];
    enabledLayers: Set<string>;
    onToggleLayer: (layerId: string) => void;
    onToggleCategory: (extensions: string[]) => void;
}
export declare const CategoriesView: React.FC<CategoriesViewProps>;
export {};
//# sourceMappingURL=CategoriesView.d.ts.map