import { BrowserWindow, ipcMain } from 'electron';
import { WindowManagerAPIEvent } from '../../shared/main-process-api-interfaces/WindowManagerAPI';
export class ElectronWindowManagerAdapter {
    mainWindow = null;
    constructor() {
        console.log('[Window Manager] Adapter instance created');
    }
    setMainWindow(window) {
        this.mainWindow = window;
        console.log(`[Window Manager] Main window reference set for adapter of window ${window.id}`);
        this.mainWindow.on('enter-full-screen', () => {
            console.log(`[Window Manager] Window ${this.mainWindow?.id} entered fullscreen`);
            this.mainWindow?.webContents.send(WindowManagerAPIEvent.ON_FULLSCREEN_CHANGED, true);
        });
        this.mainWindow.on('leave-full-screen', () => {
            console.log(`[Window Manager] Window ${this.mainWindow?.id} left fullscreen`);
            this.mainWindow?.webContents.send(WindowManagerAPIEvent.ON_FULLSCREEN_CHANGED, false);
        });
    }
    // Instance method to be called by the global IPC handler
    setFullScreen(flag) {
        if (this.mainWindow) {
            console.log(`[Window Manager] Setting fullscreen to ${flag} for window ${this.mainWindow.id}`);
            this.mainWindow.setFullScreen(!!flag);
        }
        else {
            console.error('[Window Manager] setFullScreen: No main window reference on this adapter instance.');
        }
    }
}
// New function to register IPC Handlers globally
export function registerWindowManagerIpcHandlers(appWindows) {
    console.log('[Window Manager] Registering global IPC handlers...');
    ipcMain.on(WindowManagerAPIEvent.SET_FULLSCREEN, (event, flag) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('SET_FULLSCREEN: No sender window');
            return;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.windowManagerAdapter) {
            console.error(`SET_FULLSCREEN: No AppWindow or Adapter for ID ${senderWindow.id}`);
            return;
        }
        appWindow.windowManagerAdapter.setFullScreen(flag);
    });
    console.log('[Window Manager] Global IPC handlers registered.');
}
