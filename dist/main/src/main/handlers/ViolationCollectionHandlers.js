/**
 * IPC handlers for violation collection
 */
import { ipcMain } from 'electron';
import { violationCollectionService } from '../services/ViolationCollectionService';
export function registerViolationCollectionHandlers() {
    // Collect violations for packages in a repository
    ipcMain.handle('violations:collect', async (event, rootPath, packages, options) => {
        try {
            console.log('[ViolationHandlers] Collecting violations for packages:', packages.map(p => ({
                name: p.name,
                path: p.path,
                absolutePath: p.absolutePath,
                hasTypescript: p.hasTypescript,
                hasEslint: p.hasEslint
            })));
            const result = await violationCollectionService.collectViolations(rootPath, packages, options);
            // Convert Maps to arrays for serialization
            return {
                ...result,
                packages: result.packages.map(pkg => ({
                    ...pkg,
                    fileViolations: Array.from(pkg.fileViolations.entries())
                }))
            };
        }
        catch (error) {
            console.error('[ViolationHandlers] Error collecting violations:', error);
            throw error;
        }
    });
    // Clear cache
    ipcMain.handle('violations:clearCache', async (event, rootPath) => {
        violationCollectionService.clearCache(rootPath);
        return true;
    });
    console.log('[ViolationHandlers] Registered violation collection handlers');
}
