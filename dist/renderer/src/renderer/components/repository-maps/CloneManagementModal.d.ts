import React from 'react';
import type { Repository } from '../../../shared/types/repository.types';
interface CloneManagementModalProps {
    repository: Repository;
    isOpen: boolean;
    onClose: () => void;
    onCloneAdded?: (clonePath: string) => void;
    onCloneRemoved?: (clonePath: string) => void;
}
export declare const CloneManagementModal: React.FC<CloneManagementModalProps>;
export {};
//# sourceMappingURL=CloneManagementModal.d.ts.map