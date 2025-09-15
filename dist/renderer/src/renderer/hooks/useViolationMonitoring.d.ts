/**
 * Hook for integrating violation monitoring with city visualization
 */
import { HighlightLayer } from "@principal-ai/code-city-react";
import { FileTreeSource } from '../types/file-tree-source';
import { ViolationMonitoringResult } from '../services/ViolationMonitoringServiceIPC';
interface UseViolationMonitoringOptions {
    enabled?: boolean;
    includeTypescript?: boolean;
    includeEslint?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
    useCache?: boolean;
}
interface UseViolationMonitoringResult {
    violationResult: ViolationMonitoringResult | null;
    violationLayer: HighlightLayer | null;
    isMonitoring: boolean;
    error: string | null;
    refresh: () => void;
    toggleTypeScript: () => void;
    toggleESLint: () => void;
    getSummaryForFile: (filePath: string) => string | null;
}
/**
 * Hook to monitor code violations and provide highlight layers for visualization
 */
export declare function useViolationMonitoring(source: FileTreeSource | null, packageLayers: any[] | null, // PackageLayer[] from core
options?: UseViolationMonitoringOptions): UseViolationMonitoringResult;
export {};
//# sourceMappingURL=useViolationMonitoring.d.ts.map