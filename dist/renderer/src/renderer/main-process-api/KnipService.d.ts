import { KnipAnalysisResult } from '../../shared/main-process-api-interfaces/KnipAPI';
/**
 * Service layer for Knip functionality
 * ALL window.mainProcess.knip calls MUST be encapsulated here
 */
export declare class KnipService {
    /**
     * Check if Knip is available for analysis
     */
    static checkAvailability(): Promise<boolean>;
    /**
     * Run Knip analysis on a directory
     */
    static runAnalysis(directoryPath: string): Promise<KnipAnalysisResult>;
}
//# sourceMappingURL=KnipService.d.ts.map