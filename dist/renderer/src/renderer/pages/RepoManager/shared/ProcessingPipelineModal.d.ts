import React from 'react';
import type { FileTreeSource, FileTreeStats } from '../../../types/file-tree-source';
import type { PackageLayer } from "@principal-ai/codebase-composition";
interface ProcessingPipelineModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedSource?: FileTreeSource | null;
    fileTreeStats?: FileTreeStats | null;
    packageLayers?: PackageLayer[] | null;
    filterLayers?: any[] | null;
}
export declare const ProcessingPipelineModal: React.FC<ProcessingPipelineModalProps>;
export {};
//# sourceMappingURL=ProcessingPipelineModal.d.ts.map