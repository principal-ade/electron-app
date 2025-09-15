import * as fs from 'fs/promises';
/**
 * Electron/Node.js file system adapter
 */
export class ElectronFileSystemAdapter {
    async readFile(filePath) {
        return await fs.readFile(filePath, 'utf-8');
    }
    async writeFile(filePath, content) {
        await fs.writeFile(filePath, content, 'utf-8');
    }
    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    async mkdir(dirPath, options) {
        await fs.mkdir(dirPath, options);
    }
}
