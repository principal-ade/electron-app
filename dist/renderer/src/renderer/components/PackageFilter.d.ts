import React from 'react';
interface PackageFilterProps {
    directory: string;
    selectedPackages: Set<string>;
    onPackageToggle: (packageName: string) => void;
    packages?: string[];
}
export declare const PackageFilter: React.FC<PackageFilterProps>;
export {};
//# sourceMappingURL=PackageFilter.d.ts.map