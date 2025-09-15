import { KnipAnalysisResult } from '../../shared/main-process-api-interfaces/KnipAPI';

/**
 * Service layer for Knip functionality
 * ALL window.mainProcess.knip calls MUST be encapsulated here
 */
export class KnipService {
  /**
   * Check if Knip is available for analysis
   */
  static async checkAvailability(): Promise<boolean> {
    return window.mainProcess.knip.checkAvailability();
  }

  /**
   * Run Knip analysis on a directory
   */
  static async runAnalysis(directoryPath: string): Promise<KnipAnalysisResult> {
    return window.mainProcess.knip.runAnalysis(directoryPath);
  }
}