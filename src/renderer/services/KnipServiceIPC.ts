/**
 * Renderer-side service for Knip analysis
 * Uses the new MainProcessAPI architecture
 */

import { KnipService } from '../main-process-api/KnipService';
import type { KnipAnalysisResult } from '../../shared/main-process-api-interfaces/KnipAPI';

export type { KnipAnalysisResult };

export class KnipServiceIPC {
  async runAnalysis(directoryPath: string): Promise<KnipAnalysisResult> {
    try {
      return await KnipService.runAnalysis(directoryPath);
    } catch (error) {
      console.error('[KnipServiceIPC] Error running analysis:', error);
      return {
        error: `Failed to run Knip analysis: ${error}`,
        hasIssues: false,
      };
    }
  }

  async checkAvailability(): Promise<boolean> {
    try {
      return await KnipService.checkAvailability();
    } catch (error) {
      console.error('[KnipServiceIPC] Error checking availability:', error);
      return false;
    }
  }
}

export const knipServiceIPC = new KnipServiceIPC();
