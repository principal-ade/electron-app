import React from 'react';
interface StatusBadgeProps {
    type: 'monorepo' | 'workspace' | 'conflict' | 'warning' | 'info';
    label?: string;
    size?: 'small' | 'medium';
}
export declare const StatusBadge: React.FC<StatusBadgeProps>;
export {};
//# sourceMappingURL=StatusBadge.d.ts.map