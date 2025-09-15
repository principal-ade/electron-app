import React from 'react';
interface FileViewerProps {
    filePath: string;
    displayPath?: string;
    onClose?: () => void;
    className?: string;
    enableVimMode?: boolean;
    editable?: boolean;
    onSave?: (content: string) => Promise<void>;
    onModifiedChange?: (isModified: boolean) => void;
    hideInternalSaveButton?: boolean;
    onContentChange?: (content: string) => void;
    fileEdits?: Array<{
        old_string: string;
        new_string: string;
        line?: number;
        timestamp?: number;
    }> | null;
    eventSequence?: Array<{
        type: string;
        timestamp: number;
        data: any;
    }> | null;
    initialContent?: string;
    contentLoader?: () => Promise<string | null>;
}
export declare const FileViewer: React.FC<FileViewerProps>;
export {};
//# sourceMappingURL=FileViewer.d.ts.map