import React from 'react';
interface FileTypeInfo {
    extension: string;
    count: number;
    color: string;
    icon: string;
    name: string;
    category?: string;
}
interface FileViewProps {
    fileTypeStats: FileTypeInfo[];
    enabledLayers: Set<string>;
    onToggleLayer: (layerId: string) => void;
}
export declare const FileView: React.FC<FileViewProps>;
export {};
//# sourceMappingURL=FileView.d.ts.map