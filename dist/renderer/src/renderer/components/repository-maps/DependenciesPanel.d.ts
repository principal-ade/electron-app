import React from 'react';
import type { PackageLayer } from "@principal-ai/codebase-composition";
interface DependenciesPanelProps {
    packageLayers: PackageLayer[] | null;
    onAnalysisComplete?: (results: DependencyAnalysisResults) => void;
    onPackageAnalysisStart?: (packagePath: string, packageName: string) => void;
    onPackageAnalysisEnd?: () => void;
    onPackageSelected?: (packagePath: string, packageName: string) => void;
    onPackageDeselected?: () => void;
}
export interface DependencyAnalysisResults {
    packageName: string;
    packagePath: string;
    totalDependencies: number;
    outdatedCount: number;
    vulnerabilityCount: number;
    licenseIssues: number;
    versionResults: any[];
    vulnerabilityResults: any[];
    licenseResults: any[];
}
export declare const DependenciesPanel: React.FC<DependenciesPanelProps>;
export {};
//# sourceMappingURL=DependenciesPanel.d.ts.map