import React from 'react';
interface FileInfo {
    path: string;
    relativePath?: string;
    lastModified?: number;
}
interface MultiFileEditorWindowProps {
    sessionId: string;
    sessionName?: string;
    files: FileInfo[];
    repositoryPath: string;
    isRemote?: boolean;
    remoteInfo?: {
        owner: string;
        repo: string;
        branch?: string;
    };
    isLocal?: boolean;
    localInfo?: {
        path: string;
        branch?: string;
    };
}
export declare const MultiFileEditorWindow: React.FC<MultiFileEditorWindowProps>;
export {};
//# sourceMappingURL=MultiFileEditorWindow.d.ts.map