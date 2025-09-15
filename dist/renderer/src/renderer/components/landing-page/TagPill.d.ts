import React from 'react';
interface TagPillProps {
    label: string;
    active?: boolean;
    excluded?: boolean;
    count?: number;
    onClick?: (e: React.MouseEvent) => void;
    onRightClick?: (e: React.MouseEvent) => void;
    onRemove?: () => void;
    showRemove?: boolean;
    color?: string;
}
export declare const TagPill: React.FC<TagPillProps>;
export {};
//# sourceMappingURL=TagPill.d.ts.map