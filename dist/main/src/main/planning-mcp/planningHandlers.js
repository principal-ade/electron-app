import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
// Simple IPC handlers for planning operations
export function registerPlanningHandlers() {
    // Load or create planning document
    ipcMain.handle('planning:load-document', async (event, filePath) => {
        try {
            let content = '';
            let exists = false;
            try {
                content = await fs.readFile(filePath, 'utf-8');
                exists = true;
            }
            catch (err) {
                // File doesn't exist, return null to let renderer create default
                return null;
            }
            const slides = content.split(/\n---\n/).filter(slide => slide.trim().length > 0);
            return {
                filePath,
                content,
                slides,
                currentSlide: 0,
                metadata: {
                    title: path.basename(filePath, '.md'),
                    lastModified: exists ? new Date() : undefined,
                    totalSlides: slides.length
                }
            };
        }
        catch (error) {
            console.error('[Planning] Error loading document:', error);
            throw error;
        }
    });
    // Save planning document
    ipcMain.handle('planning:save-document', async (event, filePath, content) => {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            // Save to file
            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true };
        }
        catch (error) {
            console.error('[Planning] Error saving document:', error);
            return { success: false, error: error.message };
        }
    });
}
