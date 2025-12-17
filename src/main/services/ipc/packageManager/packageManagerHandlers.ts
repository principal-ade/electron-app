import { ipcMain } from 'electron';
import { PackageManagerService } from '../../packageManagerService';
import { PackageManagerAPIEvent } from '../../../../shared/main-process-api-interfaces/PackageManagerAPI';

const packageManagerService = new PackageManagerService();

export function registerPackageManagerHandlers() {
  // Check versions handler
  ipcMain.handle(
    PackageManagerAPIEvent.CHECK_VERSIONS,
    async (event, params) => {
      const { packages, options } = params;
      const results: any[] = [];

      try {
        // Use async generator to stream results
        for await (const result of packageManagerService.checkVersions(
          packages,
          options?.batchSize || 5,
        )) {
          results.push(result);
          // Send progress update to renderer
          event.sender.send(PackageManagerAPIEvent.VERSION_CHECK_PROGRESS, {
            current: results.length,
            total: packages.length,
            result,
          });
        }

        return results;
      } catch (error) {
        console.error('Error checking versions:', error);
        throw error;
      }
    },
  );

  // Check vulnerabilities handler
  ipcMain.handle(
    PackageManagerAPIEvent.CHECK_VULNERABILITIES,
    async (event, params) => {
      const { packages, options } = params;
      const results: any[] = [];

      try {
        // Use async generator to stream results
        for await (const result of packageManagerService.checkVulnerabilities(
          packages,
          options?.batchSize || 5,
        )) {
          results.push(result);
          // Send progress update to renderer
          event.sender.send(
            PackageManagerAPIEvent.VULNERABILITY_CHECK_PROGRESS,
            {
              current: results.length,
              total: packages.length,
              result,
            },
          );
        }

        return results;
      } catch (error) {
        console.error('Error checking vulnerabilities:', error);
        throw error;
      }
    },
  );

  // Check licenses handler
  ipcMain.handle(
    PackageManagerAPIEvent.CHECK_LICENSES,
    async (event, params) => {
      const { packages, options } = params;
      const results: any[] = [];

      try {
        // Use async generator to stream results
        for await (const result of packageManagerService.checkLicenses(
          packages,
          options?.batchSize || 5,
        )) {
          results.push(result);
          // Send progress update to renderer
          event.sender.send(PackageManagerAPIEvent.LICENSE_CHECK_PROGRESS, {
            current: results.length,
            total: packages.length,
            result,
          });
        }

        return results;
      } catch (error) {
        console.error('Error checking licenses:', error);
        throw error;
      }
    },
  );
}
