export class FileSystemService {
  static async getFileStats(filePath: string) {
    return window.mainProcess.fileSystem.getFileStats(filePath);
  }

  static async readFile(filePath: string) {
    return window.mainProcess.fileSystem.readFile(filePath);
  }

  static async readDirectory(filePath: string) {
    return window.mainProcess.fileSystem.readDirectory(filePath);
  }

  static async writeFile(filePath: string, content: string) {
    return window.mainProcess.fileSystem.writeFile(filePath, content);
  }

  static async watchFile(filePath: string) {
    console.info(`[FileSystemService] Watching file: ${filePath}`);
    return window.mainProcess.fileSystem.watchFile(filePath);
  }

  static onFileChange(
    callback: (event: {
      type: string;
      path: string;
      extension?: string;
      stats?: unknown;
      isCurrentFile?: boolean;
    }) => void,
  ) {
    return window.mainProcess.fileSystem.onFileChange(callback);
  }

  static async stopWatchingFile(filePath: string) {
    return window.mainProcess.fileSystem.stopWatchingFile(filePath);
  }

  static async selectFile() {
    return window.mainProcess.fileSystem.selectFile();
  }

  static async selectDirectory(options?: {
    title?: string;
    buttonLabel?: string;
    properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
  }) {
    console.info(`[FileSystemService] Selecting directory`, options);
    return window.mainProcess.fileSystem.selectDirectory(options);
  }
  // TODO: These should be moved to the GitService
  static async watchGitRepository(path: string) {
    return window.mainProcess.fileSystem.watchGitRepository(path);
  }

  static async stopWatchingGit() {
    return window.mainProcess.fileSystem.stopWatchingGit();
  }

  static onGitStatusChange(
    callback: (data: {
      repoPath: string;
      changedFiles: {
        path: string;
        status: 'added' | 'modified' | 'deleted' | 'renamed';
        lastModified?: Date;
      }[];
      timestamp: string;
      initial?: boolean;
    }) => void,
  ) {
    return window.mainProcess.fileSystem.onGitStatusChange(callback);
  }

  static async getDirectoryStats(dirPath: string) {
    return window.mainProcess.fileSystem.getDirectoryStats(dirPath);
  }

  static async buildFilteredFileTree(
    directoryPath: string,
    options?: {
      gitignore?: boolean;
      ignorePatterns?: string[];
      includeStats?: boolean;
    },
  ) {
    return window.mainProcess.fileSystem.buildFilteredFileTree(
      directoryPath,
      options,
    );
  }

  static async getHomePath(): Promise<string> {
    return window.mainProcess.fileSystem.getHomePath();
  }

  static async getCurrentWorkingDirectory(): Promise<string> {
    return window.mainProcess.fileSystem.getCurrentWorkingDirectory();
  }
}
