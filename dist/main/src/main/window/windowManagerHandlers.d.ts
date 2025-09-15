import { BrowserWindow } from 'electron';
import type { ModernApplicationWindow } from './modernWindowManager';
export declare class ElectronWindowManagerAdapter {
    private mainWindow;
    constructor();
    setMainWindow(window: BrowserWindow): void;
    setFullScreen(flag: boolean): void;
}
export declare function registerWindowManagerIpcHandlers(appWindows: Map<number, ModernApplicationWindow>): void;
//# sourceMappingURL=windowManagerHandlers.d.ts.map