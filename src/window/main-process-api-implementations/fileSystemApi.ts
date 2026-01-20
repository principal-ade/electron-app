import { ipcRenderer, IpcRendererEvent } from 'electron';
import {
  FileSystemAPI,
  FileSystemAPIEvent,
} from '../../shared/main-process-api-interfaces/FileSystemAPI';

export const fileSystemAPI: FileSystemAPI = {
  selectFile: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.SELECT_FILE);
  },
  selectDirectory: async (options?: {
    title?: string;
    buttonLabel?: string;
    properties?: ('openDirectory' | 'createDirectory' | 'promptToCreate')[];
  }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.SELECT_DIRECTORY, options);
  },
  readFile: async (filePath: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.READ_FILE, filePath);
  },
  writeFile: async (filePath: string, content: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.WRITE_FILE, filePath, content);
  },
  deleteFile: async (filePath: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DELETE_FILE, filePath);
  },
  getFileStats: async (filePath: string) => {
    return ipcRenderer.invoke('file-system:get-file-stats', filePath);
  },
  readDirectory: async (dirPath: string) => {
    return ipcRenderer.invoke('file-system:read-directory', dirPath);
  },
  glob: async (pattern: string, options?: { cwd?: string }) => {
    return ipcRenderer.invoke('file-system:glob', pattern, options);
  },
  watchDirectory: async (options: {
    directoryPath: string;
    fileTypes?: string[];
    currentFilePath?: string;
  }) => {
    const result = await ipcRenderer.invoke(
      FileSystemAPIEvent.WATCH_DIRECTORY,
      options,
    );
    return result;
  },
  watchFile: async (filePath: string) => {
    const result = await ipcRenderer.invoke(
      FileSystemAPIEvent.WATCH_FILE,
      filePath,
    );
    return result;
  },
  stopWatchingFile: async (filePath: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_FILE, filePath);
  },
  stopWatchingDirectory: async (directoryPath: string) => {
    return ipcRenderer.invoke(
      FileSystemAPIEvent.STOP_WATCHING_DIRECTORY,
      directoryPath,
    );
  },
  watchSubdirectory: async (directoryPath: string) => {
    const result = await ipcRenderer.invoke(
      FileSystemAPIEvent.WATCH_SUBDIRECTORY,
      directoryPath,
    );
    return result;
  },
  watchFiles: async (options: { filePaths: string[] }) => {
    const result = await ipcRenderer.invoke(
      FileSystemAPIEvent.WATCH_FILES,
      options,
    );
    return result;
  },
  stopWatchingSubdirectory: async (directoryPath: string) => {
    return ipcRenderer.invoke(
      FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY,
      directoryPath,
    );
  },
  stopWatching: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING);
  },
  stopWatchingFiles: async () => {
    const result = await ipcRenderer.invoke(
      FileSystemAPIEvent.STOP_WATCHING_FILES,
    );
    return result;
  },
  onFileChange: (
    callback: (event: {
      type: string;
      path: string;
      extension?: string;
      stats?: unknown;
      isCurrentFile?: boolean;
    }) => void,
  ) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: {
        type: string;
        path: string;
        extension?: string;
        stats?: unknown;
        isCurrentFile?: boolean;
      },
    ) => {
      callback(data);
    };
    ipcRenderer.on('file-change', subscription);
    return () => {
      ipcRenderer.removeListener('file-change', subscription);
    };
  },
  onFileOpened: (
    callback: (data: { content: string; filePath: string }) => void,
  ) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: { content: string; filePath: string },
    ) => callback(data);
    ipcRenderer.on('file-opened', subscription);
    return () => {
      ipcRenderer.removeListener('file-opened', subscription);
    };
  },
  watchGitRepository: async (repoPath: string) => {
    return ipcRenderer.invoke(
      FileSystemAPIEvent.WATCH_GIT_REPOSITORY,
      repoPath,
    );
  },
  stopWatchingGit: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_GIT);
  },
  onGitStatusChange: (
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
  ) => {
    const subscription = (
      _event: IpcRendererEvent,
      data: {
        repoPath: string;
        changedFiles: {
          path: string;
          status: 'added' | 'modified' | 'deleted' | 'renamed';
          lastModified?: Date;
        }[];
        timestamp: string;
        initial?: boolean;
      },
    ) => {
      callback(data);
    };
    ipcRenderer.on('git-status-change', subscription);
    return () => {
      ipcRenderer.removeListener('git-status-change', subscription);
    };
  },
  getHomePath: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_HOME_PATH);
  },
  getCurrentWorkingDirectory: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_CURRENT_WORKING_DIRECTORY);
  },
  getDirectoryStats: async (dirPath: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_DIRECTORY_STATS, dirPath);
  },
  getGlobalSkills: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_GLOBAL_SKILLS);
  },
  // Skills Git sync methods
  syncGlobalSkills: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.SYNC_GLOBAL_SKILLS);
  },
  getSyncStatus: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_SYNC_STATUS);
  },
  getSyncConfig: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_SYNC_CONFIG);
  },
  updateSyncConfig: async (updates: any) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.UPDATE_SYNC_CONFIG, updates);
  },
  enableSkillSync: async (options: { skillPath: string; syncSource: 'git-global' | 'github' }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.ENABLE_SKILL_SYNC, options);
  },
  disableSkillSync: async (options: { skillPath: string }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DISABLE_SKILL_SYNC, options);
  },
  resolveSkillConflict: async (options: { skillPath: string; resolution: 'keep-local' | 'use-remote' }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.RESOLVE_SKILL_CONFLICT, options);
  },
  // Skills repository initialization
  getAllLocalSkills: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_ALL_LOCAL_SKILLS);
  },
  initializeSkillsRepo: async (options: { repoUrl?: string }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.INITIALIZE_SKILLS_REPO, options);
  },
  migrateSkillsToRepo: async (options: { skillPaths: string[] }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.MIGRATE_SKILLS_TO_REPO, options);
  },
  pushSkillsRepo: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.PUSH_SKILLS_REPO);
  },
  detectUnsyncedSkills: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DETECT_UNSYNCED_SKILLS);
  },
  addSkillsToRepo: async (options: { skillPaths: string[] }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.ADD_SKILLS_TO_REPO, options);
  },
  // Global skill directories management
  getSkillDirectories: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_SKILL_DIRECTORIES);
  },
  addSkillDirectory: async (directory: any) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.ADD_SKILL_DIRECTORY, directory);
  },
  updateSkillDirectory: async (options: { id: string; updates: any }) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.UPDATE_SKILL_DIRECTORY, options);
  },
  removeSkillDirectory: async (id: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.REMOVE_SKILL_DIRECTORY, id);
  },
  detectPresetDirectories: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DETECT_PRESET_DIRECTORIES);
  },
  createAgentDirectories: async (agentIds: string[]) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.CREATE_AGENT_DIRECTORIES, agentIds);
  },
  deleteAgentDirectory: async (agentId: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DELETE_AGENT_DIRECTORY, agentId);
  },
  deleteSkill: async (skillPath: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.DELETE_SKILL, skillPath);
  },
  syncSingleDirectory: async (directoryId: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.SYNC_SINGLE_DIRECTORY, directoryId);
  },
  // Pending changes methods (watch-notify-confirm workflow)
  getPendingChanges: async () => {
    return ipcRenderer.invoke(FileSystemAPIEvent.GET_PENDING_CHANGES);
  },
  clearPendingChanges: async (directoryId: string) => {
    return ipcRenderer.invoke(FileSystemAPIEvent.CLEAR_PENDING_CHANGES, directoryId);
  },
  onPendingChangesUpdated: (callback: (event: any) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload);
    ipcRenderer.on(FileSystemAPIEvent.PENDING_CHANGES_UPDATED, handler);
    return () => {
      ipcRenderer.removeListener(FileSystemAPIEvent.PENDING_CHANGES_UPDATED, handler);
    };
  },
};
