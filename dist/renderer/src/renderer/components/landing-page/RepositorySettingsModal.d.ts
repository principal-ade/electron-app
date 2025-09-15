import React from 'react';
import type { Repository } from '../../../shared/types/repository.types';
interface RepositorySettingsModalProps {
    repository: Repository;
    isOpen: boolean;
    onClose: () => void;
    onDeleteRepository: (repo: Repository) => void;
    onRemoveLocalClone: (repo: Repository, clonePath: string) => void;
    onUpdateRepository?: (repo: Repository) => void;
}
export declare const RepositorySettingsModal: React.FC<RepositorySettingsModalProps>;
export {};
//# sourceMappingURL=RepositorySettingsModal.d.ts.map