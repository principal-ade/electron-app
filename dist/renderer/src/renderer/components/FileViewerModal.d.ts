import React from 'react';
interface FileViewerModalProps {
    filePath: string;
    displayPath?: string;
    onClose: () => void;
    contentLoader?: () => Promise<string | null>;
    initialContent?: string;
    editable?: boolean;
    onSave?: (content: string) => Promise<void>;
}
export declare const FileViewerModal: React.FC<FileViewerModalProps>;
export {};
//# sourceMappingURL=FileViewerModal.d.ts.map