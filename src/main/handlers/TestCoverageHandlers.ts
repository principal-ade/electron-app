/**
 * IPC handlers for test coverage collection
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { testCoverageService } from '../services/TestCoverageService';

export function registerTestCoverageHandlers() {
  // Collect test coverage for packages
  ipcMain.handle('collect-test-coverage', async (
    event: IpcMainInvokeEvent,
    rootPath: string,
    packages: Array<{
      name: string;
      path: string;
    }>,
    options: {
      watchMode?: boolean;
      updateSnapshot?: boolean;
      bail?: boolean;
      maxWorkers?: number;
    }
  ) => {
    try {
      console.log('[TestCoverageHandlers] Collecting coverage request:', {
        rootPath,
        packages: packages.map(p => ({ name: p.name, path: p.path })),
        options
      });
      const result = await testCoverageService.collectCoverage(rootPath, packages, options);
      
      // Convert Maps to arrays for serialization
      return {
        ...result,
        packages: result.packages.map(pkg => ({
          ...pkg,
          fileCoverage: Array.from(pkg.fileCoverage.entries())
        }))
      };
    } catch (error) {
      console.error('[TestCoverageHandlers] Error collecting coverage:', error);
      throw error;
    }
  });
  
  // Cancel coverage collection for a specific package
  ipcMain.handle('cancel-test-coverage', async (
    event: IpcMainInvokeEvent,
    packageName: string
  ) => {
    try {
      testCoverageService.cancelCoverage(packageName);
      return true;
    } catch (error) {
      console.error('[TestCoverageHandlers] Error canceling coverage:', error);
      throw error;
    }
  });
  
  // Cancel all coverage collections
  ipcMain.handle('cancel-all-test-coverage', async (event: IpcMainInvokeEvent) => {
    try {
      testCoverageService.cancelAllCoverage();
      return true;
    } catch (error) {
      console.error('[TestCoverageHandlers] Error canceling all coverage:', error);
      throw error;
    }
  });
  
  console.log('[TestCoverageHandlers] Registered test coverage handlers');
}