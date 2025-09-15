import React from 'react';
import type { AlexandriaEntry } from '@a24z/core-library';
interface AlexandriaEntryListProps {
    repositories: AlexandriaEntry[];
    onSelectRepository: (repo: AlexandriaEntry) => void;
    onRefresh?: () => void;
    isLoading?: boolean;
}
export declare const AlexandriaRepositoryList: React.FC<AlexandriaEntryListProps>;
export {};
//# sourceMappingURL=AlexandriaRepositoryList.d.ts.map