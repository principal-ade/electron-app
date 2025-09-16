import { Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron';
export default class MenuBuilder {
    mainWindow: BrowserWindow;
    private createWindowFn;
    constructor(mainWindow: BrowserWindow, createWindowFn: () => void);
    buildMenu(): Menu;
    setupDevelopmentEnvironment(): void;
    buildDarwinTemplate(): MenuItemConstructorOptions[];
    buildDefaultTemplate(): {
        label: string;
        submenu: {
            label: string;
            accelerator: string;
            click: () => void;
        }[];
    }[];
}
//# sourceMappingURL=menu.d.ts.map