import React from 'react';
import type { Repository } from '../../../../shared/types/repository.types';
import type { FileTree } from "@principal-ai/repository-abstraction";
import type { PackageLayer } from "@principal-ai/codebase-composition";
import type { HighlightLayer } from "@principal-ai/code-city-react";
import type { ViolationMonitoringResult } from '../../../services/ViolationMonitoringServiceIPC';
interface ValidationsTabProps {
    repository: Repository;
    fileTree: FileTree | null;
    packageLayers?: PackageLayer[] | null;
    violationResult?: ViolationMonitoringResult | null;
    isMonitoring?: boolean;
    selectedPackage?: string | null;
    onPackageSelect?: (packagePath: string) => void;
    onRefresh?: (packagePath?: string, validationType?: string) => void;
    onHighlightChange?: (layers: HighlightLayer[]) => void;
}
export declare const ValidationsTab: React.FC<ValidationsTabProps>;
export {};
//# sourceMappingURL=ValidationsTab.d.ts.map