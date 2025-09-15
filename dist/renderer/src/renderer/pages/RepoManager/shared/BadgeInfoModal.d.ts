import React from 'react';
import type { Repository } from '../../../../shared/types/repository.types';
import type { GitBranchStatus } from '../../../main-process-api/GitService';
interface BadgeInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    repository: Repository;
    selectedClonePath?: string;
    cloneBranchStatuses: Record<string, GitBranchStatus>;
    setCloneBranchStatuses: React.Dispatch<React.SetStateAction<Record<string, GitBranchStatus>>>;
}
export declare const BadgeInfoModal: React.FC<BadgeInfoModalProps>;
export {};
//# sourceMappingURL=BadgeInfoModal.d.ts.map