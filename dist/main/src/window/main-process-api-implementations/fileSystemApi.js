import { ipcRenderer } from 'electron';
import { FileSystemAPIEvent } from '../../shared/main-process-api-interfaces/FileSystemAPI';
export const fileSystemAPI = {
    selectFile: async () => {
        return ipcRenderer.invoke(FileSystemAPIEvent.SELECT_FILE);
    },
    selectDirectory: async (options) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.SELECT_DIRECTORY, options);
    },
    readFile: async (filePath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.READ_FILE, filePath);
    },
    writeFile: async (filePath, content) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.WRITE_FILE, filePath, content);
    },
    getFileStats: async (filePath) => {
        return ipcRenderer.invoke('file-system:get-file-stats', filePath);
    },
    readDirectory: async (dirPath) => {
        return ipcRenderer.invoke('file-system:read-directory', dirPath);
    },
    glob: async (pattern, options) => {
        return ipcRenderer.invoke('file-system:glob', pattern, options);
    },
    watchDirectory: async (options) => {
        const result = await ipcRenderer.invoke(FileSystemAPIEvent.WATCH_DIRECTORY, options);
        return result;
    },
    watchFile: async (filePath) => {
        const result = await ipcRenderer.invoke(FileSystemAPIEvent.WATCH_FILE, filePath);
        return result;
    },
    stopWatchingFile: async (filePath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_FILE, filePath);
    },
    stopWatchingDirectory: async (directoryPath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_DIRECTORY, directoryPath);
    },
    watchSubdirectory: async (directoryPath) => {
        const result = await ipcRenderer.invoke(FileSystemAPIEvent.WATCH_SUBDIRECTORY, directoryPath);
        return result;
    },
    watchFiles: async (options) => {
        const result = await ipcRenderer.invoke(FileSystemAPIEvent.WATCH_FILES, options);
        return result;
    },
    stopWatchingSubdirectory: async (directoryPath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_SUBDIRECTORY, directoryPath);
    },
    stopWatching: async () => {
        return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING);
    },
    stopWatchingFiles: async () => {
        const result = await ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_FILES);
        return result;
    },
    onFileChange: (callback) => {
        const subscription = (_event, data) => {
            callback(data);
        };
        ipcRenderer.on('file-change', subscription);
        return () => {
            ipcRenderer.removeListener('file-change', subscription);
        };
    },
    onFileOpened: (callback) => {
        const subscription = (_event, data) => callback(data);
        ipcRenderer.on('file-opened', subscription);
        return () => {
            ipcRenderer.removeListener('file-opened', subscription);
        };
    },
    watchGitRepository: async (repoPath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.WATCH_GIT_REPOSITORY, repoPath);
    },
    stopWatchingGit: async () => {
        return ipcRenderer.invoke(FileSystemAPIEvent.STOP_WATCHING_GIT);
    },
    onGitStatusChange: (callback) => {
        const subscription = (_event, data) => {
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
    getDirectoryStats: async (dirPath) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.GET_DIRECTORY_STATS, dirPath);
    },
    buildFilteredFileTree: async (directoryPath, options) => {
        return ipcRenderer.invoke(FileSystemAPIEvent.BUILD_FILTERED_FILE_TREE, directoryPath, options);
    },
};
