import chokidar from 'chokidar';
import { dialog, ipcMain, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import { universalGitignorePatterns as universalPatternsConfig } from "../../shared/configs";
import { FileSystemAPIEvent } from '../../shared/main-process-api-interfaces/FileSystemAPI';
export class ElectronFileSystemAdapter {
    rootPath = null;
    fileWatcher = null;
    directoryWatcher = null;
    filesWatcher = null; // Watcher for specific files
    gitWatcher = null; // Watcher for git changes
    mainWindow = null;
    currentlyWatchingPath = null;
    githubAdapter = null;
    constructor() {
        console.log('[File System] Adapter instance created');
    }
    setMainWindow(window) {
        this.mainWindow = window;
        console.log(`[File System] Main window reference set for adapter associated with window ID: ${window.id}`);
    }
    setGitHubAdapter(adapter) {
        this.githubAdapter = adapter;
        console.log(`[File System] GitHub adapter reference set`);
    }
    // Instance methods - these will be called by the global handlers
    async readFile(filePath) {
        if (!this.mainWindow) {
            console.error('[File System] readFile: No main window reference on this adapter instance.');
            return null;
        }
        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            return { content, filePath };
        }
        catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    }
    async selectFile() {
        if (!this.mainWindow) {
            console.error('[File System] selectFile: No main window reference on this adapter instance.');
            return null;
        }
        const result = await dialog.showOpenDialog(this.mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'All Supported', extensions: ['md', 'json'] },
                { name: 'Markdown', extensions: ['md'] },
                { name: 'JSON', extensions: ['json'] },
            ],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const filePath = result.filePaths[0];
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { content, filePath };
            }
            catch (error) {
                console.error('Error reading file:', error);
                return null;
            }
        }
        return null;
    }
    async selectDirectory(options) {
        if (!this.mainWindow) {
            console.error('[File System] selectDirectory: No main window reference on this adapter instance.');
            return null;
        }
        console.log('[File System] Select directory dialog requested with options:', options);
        const dialogOptions = {
            properties: options?.properties || ['openDirectory'],
            title: options?.title || 'Select a directory with markdown files',
        };
        if (options?.buttonLabel) {
            dialogOptions.buttonLabel = options.buttonLabel;
        }
        const { canceled, filePaths } = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
        if (canceled || filePaths.length === 0) {
            console.log('[File System] Directory selection canceled');
            return { canceled: true };
        }
        this.rootPath = filePaths[0]; // This state is per-adapter instance
        console.log(`[File System] Directory selected for adapter (window ${this.mainWindow.id}): ${this.rootPath}`);
        return { filePaths: [this.rootPath], canceled: false };
    }
    async writeFile(filePath, content) {
        if (!this.mainWindow) {
            console.error('[File System] writeFile: No main window reference on this adapter instance.');
            return null;
        }
        if (!filePath) {
            console.error('[File System] writeFile: No file path provided.');
            return null;
        }
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`[File System] Successfully wrote file: ${filePath}`);
            return { success: true, filePath };
        }
        catch (error) {
            console.error('[File System] Error writing file:', error);
            return { success: false, filePath, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async getHomePath() {
        return app.getPath('home');
    }
    async getCurrentWorkingDirectory() {
        const cwd = process.cwd();
        console.log('[File System] Current working directory:', cwd);
        return cwd;
    }
    async getFileStats(filePath) {
        if (!this.mainWindow) {
            console.error('[File System] getFileStats: No main window reference on this adapter instance.');
            return null;
        }
        if (!filePath || !fs.existsSync(filePath)) {
            return null;
        }
        try {
            const stats = fs.statSync(filePath);
            return {
                size: stats.size,
                isDirectory: stats.isDirectory(),
                lastModified: stats.mtime,
            };
        }
        catch (error) {
            console.error('Error getting file stats:', error);
            return null;
        }
    }
    async getDirectoryStats(dirPath) {
        if (!this.mainWindow) {
            console.error('[File System] getDirectoryStats: No main window reference on this adapter instance.');
            return null;
        }
        if (!dirPath || !fs.existsSync(dirPath)) {
            return null;
        }
        try {
            let totalFiles = 0;
            let totalDirectories = 0;
            let totalSize = 0;
            const processDirectory = (currentPath) => {
                const entries = fs.readdirSync(currentPath);
                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry);
                    try {
                        const stats = fs.statSync(fullPath);
                        if (stats.isDirectory()) {
                            totalDirectories++;
                            // Skip certain directories to avoid excessive scanning
                            if (!entry.startsWith('.') &&
                                entry !== 'node_modules' &&
                                entry !== 'dist' &&
                                entry !== 'build') {
                                processDirectory(fullPath);
                            }
                        }
                        else {
                            totalFiles++;
                            totalSize += stats.size;
                        }
                    }
                    catch (error) {
                        // Skip files/directories that can't be accessed
                        console.warn(`[File System] Could not access ${fullPath}:`, error);
                    }
                }
            };
            processDirectory(dirPath);
            return {
                totalFiles,
                totalDirectories,
                totalSize,
            };
        }
        catch (error) {
            console.error('Error getting directory stats:', error);
            return null;
        }
    }
    async readDirectory(dirPath) {
        if (!this.mainWindow) {
            console.error('[File System] readDirectory: No main window reference on this adapter instance.');
            return [];
        }
        if (!dirPath || !fs.existsSync(dirPath)) {
            return [];
        }
        try {
            const entries = fs.readdirSync(dirPath);
            return entries;
        }
        catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }
    async watchFile(filePath) {
        console.log(`[File System] Watching file: ${filePath}`);
        if (!this.mainWindow) {
            console.error('[File System] Cannot watch file: No main window reference on this adapter instance');
            return false;
        }
        // Watcher logic needs careful review for multi-window state
        if (!this.fileWatcher) {
            this.fileWatcher = this.createFileWatcher(filePath, this.mainWindow);
        }
        else {
            // If watcher exists, ensure it's watching the correct file or reconfigure
            // This might need more sophisticated handling if multiple files per window can be watched by one adapter instance
            this.fileWatcher.close();
            this.fileWatcher = this.createFileWatcher(filePath, this.mainWindow);
        }
        try {
            if (!fs.existsSync(filePath)) {
                console.error(`[File System] File does not exist: ${filePath}`);
                return false;
            }
            this.fileWatcher.add(filePath);
            return true;
        }
        catch (error) {
            console.error('[File System] ❌ Error setting up file watcher:', error);
            return false;
        }
    }
    async watchDirectory(options) {
        const { directoryPath, fileTypes = ['.md'], isSubdirectory = false, } = options;
        if (!this.mainWindow) {
            console.error('[File System] watchDirectory: No main window reference on this adapter instance.');
            return false;
        }
        if (isSubdirectory) {
            console.log(`[File System] watchDirectory: Adding path ${directoryPath} to existing watcher.`);
            // addPathToDirectoryWatcher will use the existing this.rootPath for validation.
            // It also checks if this.directoryWatcher exists.
            return this.addPathToDirectoryWatcher(directoryPath);
        }
        // This is for starting a new watch or re-initializing the watch for a new primary directory.
        console.log(`[File System] watchDirectory: Setting up new watcher for ${directoryPath}.`);
        if (this.directoryWatcher) {
            await this.directoryWatcher.close();
            this.directoryWatcher = null;
            console.log(`[File System] Closed existing directory watcher for adapter of window ${this.mainWindow.id}`);
        }
        // Set/update the rootPath and currentlyWatchingPath for this new primary watch operation.
        // This directoryPath becomes the new root against which subdirectories will be validated.
        this.rootPath = directoryPath;
        this.currentlyWatchingPath = directoryPath; // Update the path being primarily watched.
        console.log(`[File System] Root path for watcher set to: ${this.rootPath} for window ${this.mainWindow.id}`);
        try {
            if (!fs.existsSync(directoryPath)) {
                console.error(`[File System] Directory does not exist: ${directoryPath}`);
                // Reset paths if we failed to watch, as no valid root is established.
                this.rootPath = null;
                this.currentlyWatchingPath = null;
                return false;
            }
            this.directoryWatcher = chokidar.watch(directoryPath, {
                persistent: true,
                ignoreInitial: true,
                depth: 0, // Watch only the top-level directory
                awaitWriteFinish: {
                    stabilityThreshold: 300,
                    pollInterval: 100,
                },
                ignored: (itemPath) => itemPath.includes('.DS_Store') || itemPath.includes('/.'),
            });
            this.setupDirectoryWatcherEvents(this.directoryWatcher, this.mainWindow, fileTypes);
            console.log(`[File System] Directory watcher set up for ${directoryPath} by adapter of window ${this.mainWindow.id}`);
            return true;
        }
        catch (error) {
            console.error('[File System] ❌ Error setting up directory watcher:', error);
            // Reset paths if we failed to watch.
            this.rootPath = null;
            this.currentlyWatchingPath = null;
            return false;
        }
    }
    createFileWatcher(filePath, targetWindow) {
        const fileWatcher = chokidar.watch(filePath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
            alwaysStat: true,
        });
        fileWatcher
            .on('ready', () => console.log('[File System] ✅ File watcher is READY'))
            .on('error', (err) => console.error('[File System] ❌ File watcher error:', err))
            .on('change', (changedPath, stats) => {
            console.log(`[File System] 📝 File CHANGED: ${changedPath}`, stats ? `(size: ${stats.size})` : '');
            targetWindow.webContents.send('file-change', {
                type: 'change',
                path: changedPath,
                extension: path.extname(changedPath).toLowerCase(),
                stats: stats ? { size: stats.size, mtime: stats.mtime } : null,
                isCurrentFile: true,
            });
        });
        return fileWatcher;
    }
    createGitWatcher(repoPath, targetWindow) {
        const gitIndexPath = path.join(repoPath, '.git', 'index');
        if (!fs.existsSync(gitIndexPath)) {
            console.log(`[File System] No .git/index found at ${gitIndexPath}`);
            return null;
        }
        console.log(`[File System] Creating git watcher for ${gitIndexPath}`);
        const gitWatcher = chokidar.watch(gitIndexPath, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 100,
                pollInterval: 50,
            },
        });
        let debounceTimer = null;
        gitWatcher
            .on('ready', () => console.log('[File System] ✅ Git watcher is READY'))
            .on('error', (err) => console.error('[File System] ❌ Git watcher error:', err))
            .on('change', async () => {
            // Debounce multiple rapid changes
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            debounceTimer = setTimeout(async () => {
                console.log(`[File System] 📝 Git index changed, checking status...`);
                if (this.githubAdapter) {
                    try {
                        const changedFiles = await this.githubAdapter.getChangedFiles(repoPath);
                        console.log(`[File System] Found ${changedFiles.length} changed files`);
                        targetWindow.webContents.send('git-status-change', {
                            repoPath,
                            changedFiles,
                            timestamp: new Date().toISOString(),
                        });
                    }
                    catch (error) {
                        console.error('[File System] Error getting git status:', error);
                    }
                }
                else {
                    console.warn('[File System] No GitHub adapter available for git status check');
                }
            }, 300); // Wait 300ms after last change
        });
        return gitWatcher;
    }
    setupDirectoryWatcherEvents(watcher, targetWindow, fileTypes = ['.md']) {
        const isRelevantFileType = (filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            return fileTypes.includes(ext);
        };
        watcher
            .on('ready', () => console.log('[File System] ✅ Directory watcher is READY'))
            .on('error', (error) => console.error(`[File System] ❌ Directory watcher error: ${error}`))
            .on('add', (addedPath, stats) => {
            if (isRelevantFileType(addedPath)) {
                console.log(`[File System] ✨ File ADDED: ${addedPath}`);
                targetWindow.webContents.send('directory-change', {
                    type: 'add',
                    path: addedPath,
                    stats,
                });
            }
        })
            .on('unlink', (unlinkedPath) => {
            if (isRelevantFileType(unlinkedPath)) {
                console.log(`[File System] 🗑️ File DELETED: ${unlinkedPath}`);
                targetWindow.webContents.send('directory-change', {
                    type: 'unlink',
                    path: unlinkedPath,
                });
            }
        })
            .on('addDir', (addedDirPath) => {
            console.log(`[File System] 📁 Directory ADDED: ${addedDirPath}`);
            targetWindow.webContents.send('directory-change', {
                type: 'addDir',
                path: addedDirPath,
            });
        })
            .on('unlinkDir', (unlinkedDirPath) => {
            console.log(`[File System] 🗑️ Directory DELETED: ${unlinkedDirPath}`);
            targetWindow.webContents.send('directory-change', {
                type: 'unlinkDir',
                path: unlinkedDirPath,
            });
        });
    }
    async watchGitRepository(repoPath) {
        if (!this.mainWindow) {
            console.error('[File System] Cannot watch git repository: No main window reference');
            return false;
        }
        if (!this.githubAdapter) {
            console.error('[File System] Cannot watch git repository: No GitHub adapter reference');
            return false;
        }
        // Stop existing git watcher if any
        if (this.gitWatcher) {
            console.log('[File System] Stopping existing git watcher...');
            await this.gitWatcher.close();
            this.gitWatcher = null;
        }
        try {
            this.gitWatcher = this.createGitWatcher(repoPath, this.mainWindow);
            if (this.gitWatcher) {
                console.log(`[File System] Git watcher started for ${repoPath}`);
                // Send initial git status
                const changedFiles = await this.githubAdapter.getChangedFiles(repoPath);
                this.mainWindow.webContents.send('git-status-change', {
                    repoPath,
                    changedFiles,
                    timestamp: new Date().toISOString(),
                    initial: true,
                });
                return true;
            }
            console.log(`[File System] Could not create git watcher for ${repoPath} (not a git repository?)`);
            return false;
        }
        catch (error) {
            console.error('[File System] Error setting up git watcher:', error);
            return false;
        }
    }
    async stopWatchingGit() {
        if (this.gitWatcher) {
            console.log('[File System] Stopping git watcher...');
            await this.gitWatcher.close();
            this.gitWatcher = null;
            console.log('[File System] Git watcher stopped.');
            return true;
        }
        return false;
    }
    async stopWatching() {
        let stoppedFile = true;
        let stoppedDir = true;
        let stoppedGit = true;
        if (this.fileWatcher) {
            console.log('[File System] Stopping file watcher...');
            await this.fileWatcher.close();
            this.fileWatcher = null;
            stoppedFile = true;
            console.log('[File System] File watcher stopped.');
        }
        if (this.directoryWatcher) {
            console.log('[File System] Stopping directory watcher...');
            await this.directoryWatcher.close();
            this.directoryWatcher = null;
            stoppedDir = true;
            console.log('[File System] Directory watcher stopped.');
        }
        if (this.gitWatcher) {
            stoppedGit = await this.stopWatchingGit();
        }
        this.currentlyWatchingPath = null;
        return stoppedFile && stoppedDir && stoppedGit;
    }
    async stopWatchingFile(filePath) {
        if (this.fileWatcher && this.currentlyWatchingPath === filePath) {
            // Simple check, may need improvement
            await this.fileWatcher.close();
            this.fileWatcher = null;
            this.currentlyWatchingPath = null;
            return true;
        }
        return false;
    }
    async stopWatchingDirectory(directoryPath) {
        if (!this.mainWindow) {
            console.error('[File System] stopWatchingDirectory: No main window reference on this adapter instance.');
            return false;
        }
        if (!this.directoryWatcher) {
            console.warn('[File System] stopWatchingDirectory: No active directory watcher to stop.');
            return false; // Nothing to stop
        }
        if (!this.rootPath) {
            // This state (active watcher but no rootPath) would be inconsistent.
            // Indicates watchDirectory(isSubdirectory:false) might not have completed setting rootPath or was bypassed.
            console.error('[File System] stopWatchingDirectory: Root path is not set, but a directory watcher exists. Inconsistent state. Attempting to close watcher.');
            try {
                await this.directoryWatcher.close();
            }
            catch (closeError) {
                console.error('[File System] stopWatchingDirectory: Error closing watcher during inconsistent state recovery:', closeError);
                // Fall through to nullify even if close fails
            }
            this.directoryWatcher = null;
            this.currentlyWatchingPath = null;
            // rootPath is already null/unset
            return false; // Indicate an issue due to inconsistent state, even if cleanup was attempted.
        }
        try {
            const resolvedPathToStop = path.resolve(directoryPath);
            const resolvedRootPath = path.resolve(this.rootPath);
            if (resolvedPathToStop === resolvedRootPath) {
                // User wants to stop watching the entire root.
                console.log(`[File System] stopWatchingDirectory: Stopping watcher for root path ${resolvedRootPath} for adapter of window ${this.mainWindow.id}.`);
                await this.directoryWatcher.close();
                this.directoryWatcher = null;
                this.currentlyWatchingPath = null;
                this.rootPath = null; // Clear the root path as it's no longer watched.
                console.log(`[File System] Directory watcher for root ${resolvedRootPath} stopped and rootPath cleared.`);
                return true;
            }
            // The path is not the root. Assume it's a subdirectory and delegate.
            // stopWatchingSubdirectory will validate if it's a child of rootPath.
            console.log(`[File System] stopWatchingDirectory: Path ${resolvedPathToStop} is not the root. Delegating to stopWatchingSubdirectory.`);
            return this.stopWatchingSubdirectory(resolvedPathToStop);
        }
        catch (error) {
            console.error(`[File System] ❌ Error in stopWatchingDirectory for path (${directoryPath}):`, error);
            return false;
        }
    }
    findFilesWithExtensions(dirPath, extensions, maxDepth = 3, currentDepth = 0) {
        let files = [];
        if (currentDepth > maxDepth)
            return files;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue;
                const entryPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    files = files.concat(this.findFilesWithExtensions(entryPath, extensions, maxDepth, currentDepth + 1));
                }
                else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
                    files.push(entryPath);
                }
            }
        }
        catch (error) {
            // console.warn(`[File System] Error finding files in ${dirPath}:`, error);
        }
        return files;
    }
    /**
     * Glob pattern matching for files
     */
    async glob(pattern, options) {
        if (!this.mainWindow) {
            console.error('[File System] glob: No main window reference on this adapter instance.');
            return [];
        }
        const workingDir = options?.cwd || process.cwd();
        if (!fs.existsSync(workingDir)) {
            console.error(`[File System] glob: Working directory does not exist: ${workingDir}`);
            return [];
        }
        try {
            // Simple glob implementation for **/*.ext patterns
            if (pattern.startsWith('**/') && pattern.includes('.')) {
                const extension = pattern.substring(pattern.lastIndexOf('.'));
                return this.findFilesWithExtensions(workingDir, [extension], 10, 0).map((filePath) => path.relative(workingDir, filePath));
            }
            // For other patterns, use a basic implementation
            return this.findFilesWithGlobPattern(workingDir, pattern);
        }
        catch (error) {
            console.error('[File System] Error in glob pattern matching:', error);
            return [];
        }
    }
    findFilesWithGlobPattern(dirPath, pattern, maxDepth = 10, currentDepth = 0) {
        let files = [];
        if (currentDepth > maxDepth)
            return files;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.'))
                    continue;
                const entryPath = path.join(dirPath, entry.name);
                const relativePath = path.relative(dirPath, entryPath);
                if (entry.isDirectory()) {
                    files = files.concat(this.findFilesWithGlobPattern(entryPath, pattern, maxDepth, currentDepth + 1).map((f) => path.join(relativePath, f)));
                }
                else {
                    // Simple pattern matching - convert glob to regex
                    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/\?/g, '.')}$`);
                    if (regex.test(relativePath) || regex.test(entry.name)) {
                        files.push(relativePath);
                    }
                }
            }
        }
        catch (error) {
            // console.warn(`[File System] Error in glob pattern matching for ${dirPath}:`, error);
        }
        return files;
    }
    async addPathToDirectoryWatcher(newPathToAdd) {
        if (!this.mainWindow) {
            console.error('[File System] addPathToDirectoryWatcher: No main window reference on this adapter instance.');
            return false;
        }
        if (!this.directoryWatcher) {
            console.error('[File System] addPathToDirectoryWatcher: No active directory watcher. Call watchDirectory({isSubdirectory: false}) first for a primary directory.');
            return false;
        }
        if (!this.rootPath) {
            console.error('[File System] addPathToDirectoryWatcher: Root path is not set. Call watchDirectory({isSubdirectory: false}) first for a primary directory.');
            return false;
        }
        try {
            const resolvedNewPath = path.resolve(newPathToAdd);
            const resolvedRootPath = path.resolve(this.rootPath);
            if (!resolvedNewPath.startsWith(resolvedRootPath + path.sep)) {
                console.error(`[File System] addPathToDirectoryWatcher: Path ${resolvedNewPath} is not a subdirectory of the root path ${resolvedRootPath}.`);
                return false;
            }
            if (!fs.existsSync(resolvedNewPath) ||
                !fs.statSync(resolvedNewPath).isDirectory()) {
                console.error(`[File System] addPathToDirectoryWatcher: Path is not a valid directory or does not exist: ${resolvedNewPath}`);
                return false;
            }
            this.directoryWatcher.add(resolvedNewPath);
            console.log(`[File System] Successfully added path to directory watcher: ${resolvedNewPath} for adapter of window ${this.mainWindow.id}`);
            return true;
        }
        catch (error) {
            console.error(`[File System] ❌ Error adding path to directory watcher (${newPathToAdd}):`, error);
            return false;
        }
    }
    async stopWatchingSubdirectory(subdirectoryPath) {
        if (!this.mainWindow) {
            console.error('[File System] stopWatchingSubdirectory: No main window reference on this adapter instance.');
            return false;
        }
        if (!this.directoryWatcher) {
            console.error('[File System] stopWatchingSubdirectory: No active directory watcher to remove a path from. Call watchDirectory() first.');
            return false;
        }
        if (!this.rootPath) {
            console.error('[File System] stopWatchingSubdirectory: Root path is not set. Cannot validate sub-path. Call watchDirectory() first.');
            return false;
        }
        try {
            const resolvedSubPath = path.resolve(subdirectoryPath);
            const resolvedRootPath = path.resolve(this.rootPath);
            if (resolvedSubPath === resolvedRootPath) {
                console.warn(`[File System] stopWatchingSubdirectory: Attempted to unwatch the root path (${resolvedSubPath}) using stopWatchingSubdirectory. Use stopWatchingDirectory() or stopWatching() instead.`);
                return false;
            }
            if (!resolvedSubPath.startsWith(resolvedRootPath + path.sep)) {
                console.error(`[File System] stopWatchingSubdirectory: Path ${resolvedSubPath} is not a subdirectory of the current root path ${resolvedRootPath}.`);
                return false;
            }
            // It's good practice to check if the path exists, though unwatch might handle non-existent paths gracefully.
            // For consistency with adding, we can check.
            if (!fs.existsSync(resolvedSubPath) ||
                !fs.statSync(resolvedSubPath).isDirectory()) {
                console.warn(`[File System] stopWatchingSubdirectory: Path to unwatch is not a valid directory or does not exist: ${resolvedSubPath}. Proceeding to attempt unwatch.`);
                // Depending on strictness, you could return false here.
                // Chokidar's unwatch might not error if the path isn't actively watched or doesn't exist, it just removes it from its list.
            }
            await this.directoryWatcher.unwatch(resolvedSubPath);
            console.log(`[File System] Successfully requested to stop watching subdirectory: ${resolvedSubPath} for adapter of window ${this.mainWindow.id}`);
            // Note: `unwatch` is async in some chokidar versions or usage patterns, but often acts immediately.
            // Chokidar doesn't provide a direct callback for successful unwatching of a specific path in the same way it does for `add` events.
            // We assume success if no error is thrown by the unwatch call itself.
            return true;
        }
        catch (error) {
            console.error(`[File System] ❌ Error stopping watch for subdirectory (${subdirectoryPath}):`, error);
            return false;
        }
    }
    async watchFiles(options) {
        if (!this.mainWindow) {
            console.error('[File System Adapter] watchFiles: No main window reference.');
            return false;
        }
        // Stop any existing specific files watcher for this adapter instance
        await this.stopWatchingFiles();
        if (!options.filePaths || options.filePaths.length === 0) {
            // console.log('[File System Adapter] watchFiles: No file paths provided to watch.');
            return true; // Nothing to watch
        }
        try {
            // console.log(`[File System Adapter WID-${this.mainWindow.id}] Setting up files watcher for:`, options.filePaths);
            this.filesWatcher = chokidar.watch(options.filePaths, {
                persistent: true,
                ignoreInitial: true, // Don't send events for files already existing when watcher starts
                awaitWriteFinish: {
                    stabilityThreshold: 300, // Wait for file write to complete
                    pollInterval: 100,
                },
                // depth: 0 // Not applicable when watching individual files
            });
            this.filesWatcher
                .on('unlink', (unlinkedPath) => {
                console.log(`[File System Adapter WID-${this.mainWindow.id}] File DELETED by filesWatcher: ${unlinkedPath}`);
                this.mainWindow.webContents.send('files-change', {
                    type: 'unlink',
                    path: unlinkedPath,
                });
            })
                .on('error', (error) => {
                console.error(`[File System Adapter WID-${this.mainWindow.id}] Files watcher error:`, error);
            });
            // .on('ready', () => {
            //   console.log(`[File System Adapter WID-${this.mainWindow!.id}] Files watcher is ready for ${options.filePaths.length} files.`);
            // });
            return true;
        }
        catch (error) {
            console.error(`[File System Adapter WID-${this.mainWindow.id}] Error setting up files watcher:`, error);
            this.filesWatcher = null; // Ensure it's null on error
            return false;
        }
    }
    async stopWatchingFiles() {
        if (this.filesWatcher) {
            // console.log(`[File System Adapter WID-${this.mainWindow?.id}] Stopping files watcher.`);
            try {
                await this.filesWatcher.close();
            }
            catch (error) {
                console.error(`[File System Adapter WID-${this.mainWindow?.id}] Error closing files watcher:`, error);
            }
            this.filesWatcher = null;
        }
        return true;
    }
    /**
     * Build a filtered file tree using globby with automatic .gitignore support
     */
    async buildFilteredFileTree(directoryPath, options) {
        try {
            // Default options
            const gitignore = options?.gitignore !== false; // Default to true
            const includeStats = options?.includeStats || false;
            // Extract universal patterns from the config
            const universalPatterns = Object.values(universalPatternsConfig.patterns)
                .flatMap((category) => category.directories || [])
                .map(dir => `**/${dir}/**`);
            // Combine with any additional patterns
            const ignorePatterns = [
                '.git', // Always exclude .git
                '**/.git/**', // Exclude .git at any level
                ...universalPatterns,
                ...(options?.ignorePatterns || [])
            ];
            console.log(`[File System] Using globby with gitignore=${gitignore}, ${ignorePatterns.length} ignore patterns`);
            // Use globby to get all files and directories
            const paths = await globby('**/*', {
                cwd: directoryPath,
                gitignore: gitignore,
                ignore: ignorePatterns,
                onlyFiles: false, // Include directories
                markDirectories: true, // Add trailing slash to directories
                dot: true, // Include dotfiles (except .git which is ignored)
                followSymbolicLinks: false
            });
            // Optionally gather stats
            let stats;
            if (includeStats) {
                stats = [];
                for (const relativePath of paths) {
                    const fullPath = path.join(directoryPath, relativePath);
                    try {
                        const stat = fs.statSync(fullPath);
                        stats.push({
                            path: relativePath,
                            size: stat.size,
                            isDirectory: stat.isDirectory(),
                            lastModified: stat.mtime
                        });
                    }
                    catch (error) {
                        // Skip files we can't stat
                        console.warn(`[File System] Could not stat ${fullPath}:`, error);
                    }
                }
            }
            return {
                paths,
                stats
            };
        }
        catch (error) {
            console.error(`[File System] Error building filtered file tree for ${directoryPath}:`, error);
            return { paths: [] };
        }
    }
}
// New function to register IPC Handlers globally
export function registerFileSystemIpcHandlers(appWindows) {
    console.log('[File System] Registering global IPC handlers...');
    ipcMain.handle(FileSystemAPIEvent.SELECT_FILE, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('SELECT_FILE: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('SELECT_FILE: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        return appWindow.fileSystemAdapter.selectFile();
    });
    ipcMain.handle(FileSystemAPIEvent.SELECT_DIRECTORY, async (event, options) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('SELECT_DIRECTORY: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('SELECT_DIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        return appWindow.fileSystemAdapter.selectDirectory(options);
    });
    ipcMain.handle(FileSystemAPIEvent.READ_FILE, async (event, filePath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('READ_FILE: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('READ_FILE: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        return appWindow.fileSystemAdapter.readFile(filePath);
    });
    ipcMain.handle(FileSystemAPIEvent.WRITE_FILE, async (event, filePath, content) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WRITE_FILE: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WRITE_FILE: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WRITE_FILE} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.writeFile(filePath, content);
    });
    ipcMain.handle('file-system:get-file-stats', async (event, filePath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('GET_FILE_STATS: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('GET_FILE_STATS: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        return appWindow.fileSystemAdapter.getFileStats(filePath);
    });
    ipcMain.handle('file-system:read-directory', async (event, dirPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('READ_DIRECTORY: No sender window');
            return [];
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('READ_DIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return [];
        }
        return appWindow.fileSystemAdapter.readDirectory(dirPath);
    });
    ipcMain.handle('file-system:get-directory-stats', async (event, dirPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('GET_DIRECTORY_STATS: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('GET_DIRECTORY_STATS: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        return appWindow.fileSystemAdapter.getDirectoryStats(dirPath);
    });
    ipcMain.handle(FileSystemAPIEvent.WATCH_FILE, async (event, filePath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WATCH_FILE: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WATCH_FILE: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_FILE} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.watchFile(filePath);
    });
    ipcMain.handle(FileSystemAPIEvent.WATCH_DIRECTORY, async (event, options) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WATCH_DIRECTORY: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WATCH_DIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_DIRECTORY} for window ${senderWindow.id} **********`);
        // Explicitly pass isSubdirectory: false for primary directory watching
        return appWindow.fileSystemAdapter.watchDirectory({
            ...options,
            isSubdirectory: false,
        });
    });
    ipcMain.handle(FileSystemAPIEvent.WATCH_SUBDIRECTORY, async (event, directoryPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WATCH_SUBDIRECTORY: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WATCH_SUBDIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        // fileTypes are not directly used by addPathToDirectoryWatcher in the current adapter implementation
        // but including it in case the adapter evolves. The adapter method would need to be updated to use it.
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_SUBDIRECTORY} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.addPathToDirectoryWatcher(directoryPath);
    });
    ipcMain.handle(FileSystemAPIEvent.WATCH_FILES, async (event, options) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WATCH_FILES: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WATCH_FILES: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_FILES} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.watchFiles(options);
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_FILES, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING_FILES: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING_FILES: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_FILES} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatchingFiles();
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatching();
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_FILE, async (event, filePath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING_FILE: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING_FILE: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_FILE} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatchingFile(filePath);
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_DIRECTORY, async (event, directoryPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING_DIRECTORY: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING_DIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_DIRECTORY} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatchingDirectory(directoryPath);
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY, async (event, directoryPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING_SUBDIRECTORY: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING_SUBDIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatchingSubdirectory(directoryPath);
    });
    ipcMain.handle(FileSystemAPIEvent.WATCH_GIT_REPOSITORY, async (event, repoPath) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('WATCH_GIT_REPOSITORY: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('WATCH_GIT_REPOSITORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.WATCH_GIT_REPOSITORY} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.watchGitRepository(repoPath);
    });
    ipcMain.handle(FileSystemAPIEvent.STOP_WATCHING_GIT, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('STOP_WATCHING_GIT: No sender window');
            return false;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('STOP_WATCHING_GIT: No AppWindow or Adapter for ID ', senderWindow.id);
            return false;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.STOP_WATCHING_GIT} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.stopWatchingGit();
    });
    ipcMain.handle('file-system:glob', async (event, pattern, options) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('GLOB: No sender window');
            return [];
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('GLOB: No AppWindow or Adapter for ID ', senderWindow.id);
            return [];
        }
        return appWindow.fileSystemAdapter.glob(pattern, options);
    });
    ipcMain.handle(FileSystemAPIEvent.GET_HOME_PATH, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('GET_HOME_PATH: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('GET_HOME_PATH: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.GET_HOME_PATH} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.getHomePath();
    });
    ipcMain.handle(FileSystemAPIEvent.GET_CURRENT_WORKING_DIRECTORY, async (event) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('GET_CURRENT_WORKING_DIRECTORY: No sender window');
            return null;
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('GET_CURRENT_WORKING_DIRECTORY: No AppWindow or Adapter for ID ', senderWindow.id);
            return null;
        }
        console.log(`********** GLOBAL IPC HANDLER CALLED: ${FileSystemAPIEvent.GET_CURRENT_WORKING_DIRECTORY} for window ${senderWindow.id} **********`);
        return appWindow.fileSystemAdapter.getCurrentWorkingDirectory();
    });
    // Handler for buildFilteredFileTree
    ipcMain.handle(FileSystemAPIEvent.BUILD_FILTERED_FILE_TREE, async (event, directoryPath, options) => {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        if (!senderWindow) {
            console.error('[File System] buildFilteredFileTree: No sender window found for IPC event.');
            return { paths: [] };
        }
        const appWindow = appWindows.get(senderWindow.id);
        if (!appWindow || !appWindow.fileSystemAdapter) {
            console.error('[File System] buildFilteredFileTree: No app window or file system adapter found for window ID:', senderWindow.id);
            return { paths: [] };
        }
        return appWindow.fileSystemAdapter.buildFilteredFileTree(directoryPath, options);
    });
    console.log('[File System] Global IPC handlers registered.');
}
