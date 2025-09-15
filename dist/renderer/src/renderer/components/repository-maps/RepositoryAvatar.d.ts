import React from 'react';
import type { Repository, LocalClone } from '../../../shared/types/repository.types';
interface RepositoryAvatarProps {
    repository?: Repository;
    localClone?: LocalClone;
    customAvatarUrl?: string | null;
    size?: number;
    type: 'owner' | 'repository' | 'clone';
    fallbackIcon?: React.ReactNode;
}
/**
 * Displays repository avatars with semantic shapes:
 * - Circles (50% border radius) for remote/cloud entities (owner, repository)
 * - Rounded squares (8px border radius) for local entities (clones)
 */
export declare const RepositoryAvatar: React.FC<RepositoryAvatarProps>;
export {};
//# sourceMappingURL=RepositoryAvatar.d.ts.map