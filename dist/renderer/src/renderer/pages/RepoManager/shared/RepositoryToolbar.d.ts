import React from 'react';
export interface ToolbarItem {
    id: string;
    label: string;
    shortLabel?: string;
    icon: React.ReactNode;
    count?: number;
    color?: string;
    active: boolean;
    onClick: () => void;
    tooltip?: string;
}
interface RepositoryToolbarProps {
    items: ToolbarItem[];
    position?: 'top' | 'bottom';
    expanded?: boolean;
}
export declare const RepositoryToolbar: React.FC<RepositoryToolbarProps>;
export {};
//# sourceMappingURL=RepositoryToolbar.d.ts.map