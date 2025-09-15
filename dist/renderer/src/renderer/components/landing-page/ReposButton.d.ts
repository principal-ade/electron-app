import React from 'react';
interface ReposButtonProps {
    isActive: boolean;
    onClick: () => void;
    onMouseEnter?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}
export declare const ReposButton: React.FC<ReposButtonProps>;
export {};
//# sourceMappingURL=ReposButton.d.ts.map