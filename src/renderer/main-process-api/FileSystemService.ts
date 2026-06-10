import type { GlobalSkillDirectory, SkillsRepoConfig } from '../../shared/main-process-api-interfaces/FileSystemAPI';

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

  /**
   * Persist a file dropped/pasted onto the UI (e.g. a terminal screenshot) to a
   * temp scratch location and return its absolute path. Bytes are base64-encoded
   * for transport across the IPC bridge.
   */
  static async saveDroppedFile(file: {
    name: string;
    mimeType: string;
    dataBase64: string;
  }): Promise<{ success: boolean; filePath?: string; error?: string }> {
    return window.mainProcess.fileSystem.saveDroppedFile(file);
  }

  static async deleteFile(
    filePath: string,
  ): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.fileSystem.deleteFile(filePath);
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

  static async watchDirectory(options: {
    directoryPath: string;
    fileTypes?: string[];
    isSubdirectory?: boolean;
  }) {
    console.info(`[FileSystemService] Watching directory: ${options.directoryPath}`);
    return window.mainProcess.fileSystem.watchDirectory(options);
  }

  static onDirectoryChange(
    callback: (event: {
      type: 'add' | 'unlink' | 'addDir' | 'unlinkDir';
      path: string;
      stats?: unknown;
    }) => void,
  ) {
    return window.mainProcess.fileSystem.onDirectoryChange(callback);
  }

  static async stopWatchingDirectory(directoryPath: string) {
    return window.mainProcess.fileSystem.stopWatchingDirectory(directoryPath);
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

  static async getDirectoryInfo(
    dirPath: string,
  ): Promise<{ sizeBytes: number; mtime: string } | null> {
    return window.mainProcess.fileSystem.getDirectoryInfo(dirPath);
  }

  static async getHomePath(): Promise<string> {
    return window.mainProcess.fileSystem.getHomePath();
  }

  static async getCurrentWorkingDirectory(): Promise<string> {
    return window.mainProcess.fileSystem.getCurrentWorkingDirectory();
  }

  static async getGlobalSkills() {
    return window.mainProcess.fileSystem.getGlobalSkills();
  }

  static async getFileContentAtRevision(
    repositoryPath: string,
    filePath: string,
    revision: string = 'HEAD'
  ): Promise<string | null> {
    return window.mainProcess.fileSystem.getFileContentAtRevision(
      repositoryPath,
      filePath,
      revision
    );
  }

  // Skills Git sync methods
  static async syncGlobalSkills() {
    return window.mainProcess.fileSystem.syncGlobalSkills();
  }

  static async getSyncStatus() {
    return window.mainProcess.fileSystem.getSyncStatus();
  }

  static async getSyncConfig() {
    return window.mainProcess.fileSystem.getSyncConfig();
  }

  static async updateSyncConfig(updates: Partial<SkillsRepoConfig>) {
    return window.mainProcess.fileSystem.updateSyncConfig(updates);
  }

  static async enableSkillSync(skillPath: string, syncSource: 'git-global' | 'github') {
    return window.mainProcess.fileSystem.enableSkillSync({ skillPath, syncSource });
  }

  static async disableSkillSync(skillPath: string) {
    return window.mainProcess.fileSystem.disableSkillSync({ skillPath });
  }

  static async resolveSkillConflict(skillPath: string, resolution: 'keep-local' | 'use-remote') {
    return window.mainProcess.fileSystem.resolveSkillConflict({ skillPath, resolution });
  }

  // Skills repository initialization
  static async getAllLocalSkills() {
    return window.mainProcess.fileSystem.getAllLocalSkills();
  }

  static async initializeSkillsRepo(repoUrl?: string) {
    return window.mainProcess.fileSystem.initializeSkillsRepo({ repoUrl });
  }

  static async migrateSkillsToRepo(skillPaths: string[]) {
    return window.mainProcess.fileSystem.migrateSkillsToRepo({ skillPaths });
  }

  static async pushSkillsRepo() {
    return window.mainProcess.fileSystem.pushSkillsRepo();
  }

  static async detectUnsyncedSkills() {
    return window.mainProcess.fileSystem.detectUnsyncedSkills();
  }

  static async addSkillsToRepo(skillPaths: string[]) {
    return window.mainProcess.fileSystem.addSkillsToRepo({ skillPaths });
  }

  // Global skill directories management
  static async getSkillDirectories() {
    return window.mainProcess.fileSystem.getSkillDirectories();
  }

  static async addSkillDirectory(directory: Omit<GlobalSkillDirectory, 'id' | 'localClonePath'>) {
    return window.mainProcess.fileSystem.addSkillDirectory(directory);
  }

  static async updateSkillDirectory(id: string, updates: Partial<GlobalSkillDirectory>) {
    return window.mainProcess.fileSystem.updateSkillDirectory({ id, updates });
  }

  static async removeSkillDirectory(id: string) {
    return window.mainProcess.fileSystem.removeSkillDirectory(id);
  }

  static async detectPresetDirectories() {
    return window.mainProcess.fileSystem.detectPresetDirectories();
  }

  static async createAgentDirectories(agentIds: string[]) {
    return window.mainProcess.fileSystem.createAgentDirectories(agentIds);
  }

  static async deleteAgentDirectory(agentId: string) {
    return window.mainProcess.fileSystem.deleteAgentDirectory(agentId);
  }

  static async deleteSkill(skillPath: string): Promise<{ success: boolean; error?: string }> {
    return window.mainProcess.fileSystem.deleteSkill(skillPath);
  }

  static async syncSingleDirectory(directoryId: string) {
    return window.mainProcess.fileSystem.syncSingleDirectory(directoryId);
  }

  // Pending changes methods (watch-notify-confirm workflow)
  static async getPendingChanges() {
    return window.mainProcess.fileSystem.getPendingChanges();
  }

  static async clearPendingChanges(directoryId: string) {
    return window.mainProcess.fileSystem.clearPendingChanges(directoryId);
  }

  static onPendingChangesUpdated(
    callback: (event: {
      directoryId: string;
      changes: {
        changes: Array<{ path: string; type: string }>;
        lastDetected: Date;
      };
    }) => void,
  ): () => void {
    return window.mainProcess.fileSystem.onPendingChangesUpdated(callback);
  }

  // Repository scanning for onboarding
  static async getTopLevelFolders() {
    return window.mainProcess.fileSystem.getTopLevelFolders();
  }

  static async scanFoldersForRepos(folderPaths: string[]) {
    return window.mainProcess.fileSystem.scanFoldersForRepos(folderPaths);
  }

  static onRepoScanProgress(callback: (progress: { current: number; total: number; currentFolder: string; foundRepos: number }) => void): () => void {
    return window.mainProcess.fileSystem.onRepoScanProgress(callback);
  }
}
