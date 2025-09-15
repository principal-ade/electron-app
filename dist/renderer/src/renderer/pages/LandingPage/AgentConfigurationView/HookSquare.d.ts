import React from 'react';
interface HookSquareProps {
    command: string;
    matcher: string;
    color: string;
    onEdit: () => void;
    onRemove: () => void;
    onShowInfo: () => void;
    enabled?: boolean;
    onToggle?: () => void;
    layout?: 'grid' | 'list';
}
export declare const HookSquare: React.FC<HookSquareProps>;
export {};
//# sourceMappingURL=HookSquare.d.ts.map