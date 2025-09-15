/**
 * Renderer-side service for Knip analysis
 * Uses the new MainProcessAPI architecture
 */
import { KnipService } from '../main-process-api/KnipService';
export class KnipServiceIPC {
    async runAnalysis(directoryPath) {
        try {
            return await KnipService.runAnalysis(directoryPath);
        }
        catch (error) {
            console.error('[KnipServiceIPC] Error running analysis:', error);
            return {
                error: `Failed to run Knip analysis: ${error}`,
                hasIssues: false
            };
        }
    }
    async checkAvailability() {
        try {
            return await KnipService.checkAvailability();
        }
        catch (error) {
            console.error('[KnipServiceIPC] Error checking availability:', error);
            return false;
        }
    }
}
export const knipServiceIPC = new KnipServiceIPC();
