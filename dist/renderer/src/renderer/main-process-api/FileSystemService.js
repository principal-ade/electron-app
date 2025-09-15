export class FileSystemService {
    static async getFileStats(filePath) {
        return window.mainProcess.fileSystem.getFileStats(filePath);
    }
    static async readFile(filePath) {
        return window.mainProcess.fileSystem.readFile(filePath);
    }
    static async readDirectory(filePath) {
        return window.mainProcess.fileSystem.readDirectory(filePath);
    }
    static async writeFile(filePath, content) {
        return window.mainProcess.fileSystem.writeFile(filePath, content);
    }
    static async watchFile(filePath) {
        console.info(`[FileSystemService] Watching file: ${filePath}`);
        return window.mainProcess.fileSystem.watchFile({ filePath });
    }
    static onFileChange(callback) {
        return window.mainProcess.fileSystem.onFileChange(callback);
    }
    static async stopWatchingFile(filePath) {
        return window.mainProcess.fileSystem.stopWatchingFile(filePath);
    }
    static async selectFile() {
        return window.mainProcess.fileSystem.selectFile();
    }
    static async selectDirectory(options) {
        console.info(`[FileSystemService] Selecting directory`, options);
        return window.mainProcess.fileSystem.selectDirectory(options);
    }
    // TODO: These should be moved to the GitService
    static async watchGitRepository(path) {
        return window.mainProcess.fileSystem.watchGitRepository(path);
    }
    static async stopWatchingGit() {
        return window.mainProcess.fileSystem.stopWatchingGit();
    }
    static onGitStatusChange(callback) {
        return window.mainProcess.fileSystem.onGitStatusChange(callback);
    }
    static async getDirectoryStats(dirPath) {
        return window.mainProcess.fileSystem.getDirectoryStats(dirPath);
    }
    static async buildFilteredFileTree(directoryPath, options) {
        return window.mainProcess.fileSystem.buildFilteredFileTree(directoryPath, options);
    }
    static async getHomePath() {
        return window.mainProcess.fileSystem.getHomePath();
    }
    static async getCurrentWorkingDirectory() {
        return window.mainProcess.fileSystem.getCurrentWorkingDirectory();
    }
}
