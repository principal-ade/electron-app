import React from 'react';
interface PackageInfo {
    path: string;
    name: string;
    version?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'unknown';
    pythonTool?: 'pip' | 'poetry' | 'pipenv' | 'conda';
}
interface DependenciesViewProps {
    packageDirs: PackageInfo[];
    workingDirectory: string;
    enabledLayers: Set<string>;
    onToggleLayer: (layerId: string) => void;
    onDependencyFilesFound?: (depName: string, files: string[]) => void;
    onAnalyzePackage?: (pkg: PackageInfo) => void;
}
export declare const DependenciesView: React.FC<DependenciesViewProps>;
export {};
//# sourceMappingURL=DependenciesView.d.ts.map