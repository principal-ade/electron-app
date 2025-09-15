import React from 'react';
interface EmptyStateViewProps {
    onPasteGitHubUrl: (url: string) => Promise<void>;
    onConfigureHooks: () => void;
    hasConfiguredAgents: boolean;
    onOpenLocalFolder?: () => void;
}
export declare const EmptyStateView: React.FC<EmptyStateViewProps>;
export {};
//# sourceMappingURL=EmptyStateView.d.ts.map