import React from 'react';
import type { Repository, LocalClone } from '../../../shared/types/repository.types';
interface RepositoryCardProps {
    repository: Repository;
    onRemove: () => void;
    onOpenRepo: (repo: Repository, localClone?: LocalClone) => void;
    onRemoveLocalClone: (repo: Repository, localPath: string) => void;
    onShowForkParent?: (parentRepo: {
        owner: string;
        name: string;
        url: string;
    }) => void;
    onClone?: (repo: Repository) => void;
    onOpenSettings?: (repo: Repository) => void;
    showRemoveButton?: boolean;
    showTags?: boolean;
}
export declare const RepositoryCard: React.FC<RepositoryCardProps>;
export {};
//# sourceMappingURL=RepositoryCard.d.ts.map