import React from 'react';
interface PackageManagerBadgeProps {
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'unknown';
    pythonTool?: 'pip' | 'poetry' | 'pipenv' | 'conda';
    variant?: 'solid' | 'outline';
    size?: 'small' | 'medium';
}
export declare const PackageManagerBadge: React.FC<PackageManagerBadgeProps>;
export {};
//# sourceMappingURL=PackageManagerBadge.d.ts.map