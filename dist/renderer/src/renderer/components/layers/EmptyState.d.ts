import React from 'react';
interface EmptyStateProps {
    icon?: string | React.ReactNode;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}
export declare const EmptyState: React.FC<EmptyStateProps>;
export {};
//# sourceMappingURL=EmptyState.d.ts.map