import React from 'react';
interface ForkParentModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentRepoInfo: {
        owner: string;
        name: string;
        url: string;
    } | null;
    onRepositoryAdded: () => void;
}
export declare const ForkParentModal: React.FC<ForkParentModalProps>;
export {};
//# sourceMappingURL=ForkParentModal.d.ts.map