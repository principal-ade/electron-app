import React from 'react';
import type { Repository } from '../../../../shared/types/repository.types';
interface SecretsModalProps {
    isOpen: boolean;
    onClose: () => void;
    repository: Repository;
    selectedSource?: {
        type: string;
        location: string;
    } | null;
}
export declare const SecretsModal: React.FC<SecretsModalProps>;
export {};
//# sourceMappingURL=SecretsModal.d.ts.map