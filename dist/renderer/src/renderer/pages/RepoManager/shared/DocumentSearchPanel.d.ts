import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
import { DocumentType, StorageLocation } from '../../../types/planning-storage.types';
interface DocumentSearchPanelProps {
    baseDirectory: string;
    fileTree?: FileTree | null;
    onDocumentSelect: (filePath: string, type: DocumentType, storageLocation: StorageLocation, diagramId?: string) => void;
    onDocumentDeleted?: (deletedPath: string) => void;
    selectedDocument?: string;
}
export declare const DocumentSearchPanel: React.FC<DocumentSearchPanelProps>;
export {};
//# sourceMappingURL=DocumentSearchPanel.d.ts.map