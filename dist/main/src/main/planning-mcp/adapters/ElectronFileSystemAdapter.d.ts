import { IFileSystemAdapter } from '../core/SlideDocumentManager';
/**
 * Electron/Node.js file system adapter
 */
export declare class ElectronFileSystemAdapter implements IFileSystemAdapter {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    exists(filePath: string): Promise<boolean>;
    mkdir(dirPath: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
}
//# sourceMappingURL=ElectronFileSystemAdapter.d.ts.map