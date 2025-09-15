/**
 * Renderer-side service for Knip analysis
 * Uses the new MainProcessAPI architecture
 */
import { KnipAnalysisResult } from '../../shared/main-process-api-interfaces/KnipAPI';
export { KnipAnalysisResult };
export declare class KnipServiceIPC {
    runAnalysis(directoryPath: string): Promise<KnipAnalysisResult>;
    checkAvailability(): Promise<boolean>;
}
export declare const knipServiceIPC: KnipServiceIPC;
//# sourceMappingURL=KnipServiceIPC.d.ts.map