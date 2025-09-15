import { IFileSystemAdapter } from '../core/SlideDocumentManager';
/**
 * VS Code file system adapter
 * This would use VS Code's workspace.fs API
 */
export declare class VSCodeFileSystemAdapter implements IFileSystemAdapter {
    private vscode;
    constructor(vscode: any);
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    exists(filePath: string): Promise<boolean>;
    mkdir(dirPath: string, options?: {
        recursive?: boolean;
    }): Promise<void>;
}
//# sourceMappingURL=VSCodeFileSystemAdapter.d.ts.map