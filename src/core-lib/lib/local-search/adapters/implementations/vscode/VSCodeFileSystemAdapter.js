"use strict";
/**
 * VS Code implementation of SearchFileSystemAdapter
 * Uses VS Code's workspace API for file system operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VSCodeFileSystemAdapter = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
// This file interfaces with external VSCode APIs that are not typed in this context
const constants_1 = require("../../constants");
class VSCodeFileSystemAdapter {
    constructor(vscode) {
        this.vscode = vscode;
    }
    async findMarkdownFiles(options) {
        // Create include and exclude patterns using shared utilities
        const includePattern = (0, constants_1.createIncludePattern)(options?.include);
        const excludePattern = (0, constants_1.createExclusionPattern)(options?.exclude);
        // Find files
        const files = await this.vscode.workspace.findFiles(includePattern, excludePattern, options?.maxDepth ? undefined : 10000);
        // Convert to FileInfo
        const fileInfos = [];
        for (const uri of files) {
            try {
                const stat = await this.vscode.workspace.fs.stat(uri);
                const path = uri.fsPath || uri.path;
                const name = path.split(/[/\\]/).pop() || '';
                fileInfos.push({
                    path,
                    name,
                    size: stat.size,
                    modifiedAt: new Date(stat.mtime),
                    uri: uri.toString(),
                });
            }
            catch (error) {
                // Skip files that can't be accessed
                console.warn(`Failed to stat file ${uri.toString()}:`, error);
            }
        }
        return fileInfos;
    }
    async readFile(path) {
        try {
            // Try to parse as URI first
            const uri = path.startsWith('file://')
                ? this.vscode.Uri.parse(path)
                : this.vscode.Uri.file(path);
            const document = await this.vscode.workspace.openTextDocument(uri);
            return document.getText();
        }
        catch (error) {
            throw new Error(`Failed to read file ${path}: ${error}`);
        }
    }
    watchFiles(pattern, callback) {
        const watcher = this.vscode.workspace.createFileSystemWatcher(pattern);
        // Set up event handlers
        const disposables = [];
        disposables.push(watcher.onDidCreate((uri) => {
            callback({
                type: 'created',
                path: uri.fsPath || uri.path,
            });
        }));
        disposables.push(watcher.onDidChange((uri) => {
            callback({
                type: 'changed',
                path: uri.fsPath || uri.path,
            });
        }));
        disposables.push(watcher.onDidDelete((uri) => {
            callback({
                type: 'deleted',
                path: uri.fsPath || uri.path,
            });
        }));
        // Return disposable that cleans up everything
        return {
            dispose: () => {
                watcher.dispose();
                disposables.forEach(d => d.dispose());
            },
        };
    }
    getRelativePath(path) {
        return this.vscode.workspace.asRelativePath(path);
    }
    async getFileInfo(path) {
        try {
            const uri = path.startsWith('file://')
                ? this.vscode.Uri.parse(path)
                : this.vscode.Uri.file(path);
            const stat = await this.vscode.workspace.fs.stat(uri);
            const name = path.split(/[/\\]/).pop() || '';
            return {
                path,
                name,
                size: stat.size,
                modifiedAt: new Date(stat.mtime),
                uri: uri.toString(),
            };
        }
        catch (error) {
            throw new Error(`Failed to get file info for ${path}: ${error}`);
        }
    }
    /**
     * Check if a file exists
     */
    async exists(path) {
        try {
            await this.getFileInfo(path);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get workspace root path(s)
     */
    getWorkspaceRoots() {
        if (!this.vscode.workspace.workspaceFolders) {
            return [];
        }
        return this.vscode.workspace.workspaceFolders.map((folder) => folder.uri.fsPath || folder.uri.path);
    }
}
exports.VSCodeFileSystemAdapter = VSCodeFileSystemAdapter;
