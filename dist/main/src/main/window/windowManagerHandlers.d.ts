import { BrowserWindow } from 'electron';
import type { IModernApplicationWindow } from './types';
export declare class ElectronWindowManagerAdapter {
    private mainWindow;
    constructor();
    setMainWindow(window: BrowserWindow): void;
    setFullScreen(flag: boolean): void;
}
export declare function registerWindowManagerIpcHandlers(appWindows: Map<number, IModernApplicationWindow>): void;
//# sourceMappingURL=windowManagerHandlers.d.ts.map