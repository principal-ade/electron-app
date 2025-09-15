import React from 'react';
interface LicenseBadgeProps {
    license: {
        key: string;
        name?: string;
        spdxId?: string;
        url?: string;
    };
    size?: 'small' | 'medium' | 'large';
    onClick?: () => void;
    interactive?: boolean;
    iconType?: 'shield' | 'file';
    showFullName?: boolean;
}
export declare const LicenseBadge: React.FC<LicenseBadgeProps>;
export {};
//# sourceMappingURL=LicenseBadge.d.ts.map