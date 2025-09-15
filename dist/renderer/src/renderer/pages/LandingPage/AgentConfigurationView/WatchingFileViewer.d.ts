import React from 'react';
interface WatchingFileViewerProps {
    filePath: string;
    className?: string;
    editable?: boolean;
    onSave?: (content: string) => Promise<void>;
    onModifiedChange?: (isModified: boolean) => void;
    hideInternalSaveButton?: boolean;
    onContentChange?: (content: string) => void;
}
export declare const WatchingFileViewer: React.FC<WatchingFileViewerProps>;
export {};
//# sourceMappingURL=WatchingFileViewer.d.ts.map