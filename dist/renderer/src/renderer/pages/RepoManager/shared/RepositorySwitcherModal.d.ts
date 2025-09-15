import React from 'react';
import type { Repository } from '../../../../shared/types/repository.types';
interface RepositorySwitcherModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentRepository: Repository;
    onSelectRepository: (repository: Repository, mode: 'explore' | 'develop' | 'planning', openInNewWindow: boolean) => void;
}
export declare const RepositorySwitcherModal: React.FC<RepositorySwitcherModalProps>;
export {};
//# sourceMappingURL=RepositorySwitcherModal.d.ts.map