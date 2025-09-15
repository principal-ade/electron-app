import React from 'react';
interface FileActionButtonsProps {
    fileFilter: string;
    createdFiles: number;
    deletedFiles: number;
    largeFiles: number;
    onFilterChange: (filter: string) => void;
}
export declare const FileActionButtons: React.FC<FileActionButtonsProps>;
interface ToolStatsCardsProps {
    totalCalls: number;
    uniqueTools: number;
}
export declare const ToolStatsCards: React.FC<ToolStatsCardsProps>;
interface ToolUsageCardProps {
    toolCounts: Record<string, number>;
}
export declare const ToolUsageCard: React.FC<ToolUsageCardProps>;
interface RecentToolCallsCardProps {
    toolCalls: Array<{
        toolName: string;
        timestamp: number;
        parameters: any;
    }>;
}
export declare const RecentToolCallsCard: React.FC<RecentToolCallsCardProps>;
interface KnipAnalysisStatsProps {
    unusedFiles: number;
    unusedExports: number;
    unusedDependencies: number;
    unresolvedImports: number;
}
export declare const KnipAnalysisStats: React.FC<KnipAnalysisStatsProps>;
export {};
//# sourceMappingURL=SessionDetailCards.d.ts.map