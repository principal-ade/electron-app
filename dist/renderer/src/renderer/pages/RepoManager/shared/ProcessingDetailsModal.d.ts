import React from 'react';
import type { FileTreeSource, FileTreeStats } from '../../../types/file-tree-source';
import type { PackageLayer } from "@principal-ai/codebase-composition";
interface ProcessingDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSource?: FileTreeSource | null;
    fileTreeStats?: FileTreeStats | null;
    packageLayers?: PackageLayer[] | null;
    filterLayers?: any[] | null;
}
export declare const ProcessingDetailsModal: React.FC<ProcessingDetailsModalProps>;
export {};
//# sourceMappingURL=ProcessingDetailsModal.d.ts.map