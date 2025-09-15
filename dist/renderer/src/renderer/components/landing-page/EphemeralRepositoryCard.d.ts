import React from 'react';
import type { Repository } from '../../../shared/types/repository.types';
interface EphemeralRepositoryCardProps {
    repository: Repository;
    onAddLocally: () => void;
    onOpenInGitHub: () => void;
    loading?: boolean;
}
export declare const EphemeralRepositoryCard: React.FC<EphemeralRepositoryCardProps>;
export {};
//# sourceMappingURL=EphemeralRepositoryCard.d.ts.map