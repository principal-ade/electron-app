import React from 'react';
interface GitHubSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectRepository: (repo: {
        owner: string;
        name: string;
        remoteUrl: string;
        description?: string;
    }) => void;
}
export declare const GitHubSearchModal: React.FC<GitHubSearchModalProps>;
export {};
//# sourceMappingURL=GitHubSearchModal.d.ts.map