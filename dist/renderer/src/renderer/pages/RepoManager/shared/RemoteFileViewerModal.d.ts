import React from 'react';
import { ContentProvider } from '../../../services/ContentProviders';
interface RemoteFileViewerModalProps {
    filePath: string;
    relativePath: string;
    contentProvider: ContentProvider;
    onClose: () => void;
    repository?: {
        owner: string;
        repo: string;
        branch?: string;
    };
}
export declare const RemoteFileViewerModal: React.FC<RemoteFileViewerModalProps>;
export {};
//# sourceMappingURL=RemoteFileViewerModal.d.ts.map