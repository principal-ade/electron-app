/**
 * VS Code file system adapter
 * This would use VS Code's workspace.fs API
 */
export class VSCodeFileSystemAdapter {
    vscode;
    constructor(vscode) {
        this.vscode = vscode;
    } // Would be the actual vscode API object
    async readFile(filePath) {
        // In VS Code extension:
        // const uri = vscode.Uri.file(filePath);
        // const data = await vscode.workspace.fs.readFile(uri);
        // return new TextDecoder().decode(data);
        const uri = this.vscode.Uri.file(filePath);
        const data = await this.vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(data);
    }
    async writeFile(filePath, content) {
        // In VS Code extension:
        // const uri = vscode.Uri.file(filePath);
        // const data = new TextEncoder().encode(content);
        // await vscode.workspace.fs.writeFile(uri, data);
        const uri = this.vscode.Uri.file(filePath);
        const data = new TextEncoder().encode(content);
        await this.vscode.workspace.fs.writeFile(uri, data);
    }
    async exists(filePath) {
        try {
            const uri = this.vscode.Uri.file(filePath);
            await this.vscode.workspace.fs.stat(uri);
            return true;
        }
        catch {
            return false;
        }
    }
    async mkdir(dirPath, options) {
        const uri = this.vscode.Uri.file(dirPath);
        await this.vscode.workspace.fs.createDirectory(uri);
    }
}
