import { ipcMain } from 'electron';
import { KnipAnalysisService } from '../../knipAnalysisService';

export function registerKnipHandlers() {
  ipcMain.handle('knip:check-availability', async () => {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Try to check if knip is available globally or locally
      try {
        await execAsync('npx knip --version', { timeout: 5000 });
        return true;
      } catch {
        try {
          await execAsync('knip --version', { timeout: 5000 });
          return true;
        } catch {
          return false;
        }
      }
    } catch (error) {
      console.error('[Knip] Error checking availability:', error);
      return false;
    }
  });

  ipcMain.handle('knip:run-analysis', async (event, directoryPath: string) => {
    try {
      return await KnipAnalysisService.runAnalysis(directoryPath);
    } catch (error) {
      console.error('[Knip] Error running analysis:', error);
      return {
        error: `Failed to run Knip analysis: ${error}`,
        hasIssues: false,
      };
    }
  });
}
