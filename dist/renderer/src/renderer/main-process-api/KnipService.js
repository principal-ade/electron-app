/**
 * Service layer for Knip functionality
 * ALL window.mainProcess.knip calls MUST be encapsulated here
 */
export class KnipService {
    /**
     * Check if Knip is available for analysis
     */
    static async checkAvailability() {
        return window.mainProcess.knip.checkAvailability();
    }
    /**
     * Run Knip analysis on a directory
     */
    static async runAnalysis(directoryPath) {
        return window.mainProcess.knip.runAnalysis(directoryPath);
    }
}
