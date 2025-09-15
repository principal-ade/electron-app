import { ipcMain, clipboard } from 'electron';
import { ClipboardAPIEvent } from '../../shared/main-process-api-interfaces/ClipboardAPI';
export class ElectronClipboardAdapter {
    constructor() {
        this.setupIpcHandlers();
    }
    setupIpcHandlers() {
        // Handle clipboard write requests from renderer
        ipcMain.handle(ClipboardAPIEvent.WRITE_TEXT, async (event, text) => {
            try {
                clipboard.writeText(text);
                return { success: true };
            }
            catch (error) {
                console.error('Failed to write to clipboard:', error);
                return { success: false, error: error.message };
            }
        });
        // Handle clipboard read requests from renderer
        ipcMain.handle(ClipboardAPIEvent.READ_TEXT, async () => {
            try {
                const text = clipboard.readText();
                return { success: true, text };
            }
            catch (error) {
                console.error('Failed to read from clipboard:', error);
                return { success: false, error: error.message };
            }
        });
        // Check if clipboard is available
        ipcMain.handle(ClipboardAPIEvent.IS_AVAILABLE, async () => {
            try {
                // Try to read empty string to check if clipboard is accessible
                clipboard.readText();
                return true;
            }
            catch {
                return false;
            }
        });
    }
}
