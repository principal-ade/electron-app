import React from 'react';
import { FileTree } from "@principal-ai/repository-abstraction";
interface DocumentationPanelProps {
    fileTree?: FileTree | null;
    onDocumentSelect: (filePath: string, type: 'markdown' | 'excalidraw') => void;
    selectedDocument?: string;
}
export declare const DocumentationPanel: React.FC<DocumentationPanelProps>;
export {};
//# sourceMappingURL=DocumentationPanel.d.ts.map