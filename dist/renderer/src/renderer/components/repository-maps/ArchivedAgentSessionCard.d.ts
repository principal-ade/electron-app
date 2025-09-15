import React from 'react';
interface ArchiveStatus {
    willArchive: boolean;
    timeUntilArchive: number | null;
    percentageToArchive: number;
    reason?: string;
}
interface ArchivedAgentSessionCardProps {
    session: any;
    isSelected: boolean;
    isActive: boolean;
    timeAgoStr: string;
    needsReview: boolean;
    largeFileCount: number;
    warningFileCount: number;
    maxLineCount: number;
    createdFiles: number;
    deletedFiles: number;
    fileAccessCount?: number;
    fileWriteCount?: number;
    toolCallCount?: number;
    showStatus?: boolean;
    webAccessCount?: number;
    onClick: () => void;
    workingDirectory?: string;
    agentColor?: string;
    archiveStatus?: ArchiveStatus;
    isArchived?: boolean;
    onArchive?: () => void;
    onDismiss?: () => void;
    layerFilter?: 'current' | 'recent' | 'all';
    onLayerFilterChange?: (sessionId: string, filter: 'current' | 'recent' | 'all') => void;
    onDebugClick?: () => void;
}
export declare const ArchivedAgentSessionCard: React.FC<ArchivedAgentSessionCardProps>;
export {};
//# sourceMappingURL=ArchivedAgentSessionCard.d.ts.map