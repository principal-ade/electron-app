import React from 'react';
import { FileTreeSource } from '../../types/file-tree-source';
interface AgentSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    sources: FileTreeSource[];
    repositoryName?: string;
}
export declare const AgentSelectionModal: React.FC<AgentSelectionModalProps>;
export {};
//# sourceMappingURL=AgentSelectionModal.d.ts.map