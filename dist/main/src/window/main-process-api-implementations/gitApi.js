import { ipcRenderer } from 'electron';
import { GitEvents } from '../../shared/main-process-api-interfaces/GitAPI';
export const gitAPI = {
    getRepositoryInfo: async (filePath) => {
        return ipcRenderer.invoke(GitEvents.GET_REPOSITORY_INFO, filePath);
    },
    checkIfPrivateRepo: async (remoteUrl) => {
        return ipcRenderer.invoke(GitEvents.CHECK_IF_PRIVATE_REPO, remoteUrl);
    },
    getStatus: async (directory) => {
        return ipcRenderer.invoke(GitEvents.GET_STATUS, directory);
    },
    getDetailedChanges: async (directory, files) => {
        return ipcRenderer.invoke(GitEvents.GET_DETAILED_CHANGES, directory, files);
    },
    getUncommittedChanges: async (directory) => {
        return ipcRenderer.invoke(GitEvents.GET_UNCOMMITTED_CHANGES, directory);
    },
    stageFiles: async (directory, files) => {
        return ipcRenderer.invoke(GitEvents.STAGE_FILES, directory, files);
    },
    createCommit: async (directory, message) => {
        return ipcRenderer.invoke(GitEvents.CREATE_COMMIT, directory, message);
    },
    execCommand: async (directory, args) => {
        return ipcRenderer.invoke(GitEvents.EXECUTE_COMMAND, directory, args);
    },
    cloneRepository: async (remoteUrl, targetPath) => {
        return ipcRenderer.invoke(GitEvents.CLONE_REPOSITORY, remoteUrl, targetPath);
    },
    checkAuthMethods: async (remoteUrl) => {
        return ipcRenderer.invoke(GitEvents.CHECK_AUTH_METHODS, remoteUrl);
    },
    deleteGitRepository: async (repoPath) => {
        return ipcRenderer.invoke(GitEvents.DELETE_GIT_REPOSITORY, repoPath);
    },
    forceDeleteGitRepository: async (repoPath) => {
        return ipcRenderer.invoke(GitEvents.FORCE_DELETE_GIT_REPOSITORY, repoPath);
    },
    // Add listener for git status updates from GitRepositoryWatcher
    onStatusUpdate: (callback) => {
        const handler = (_event, status) => callback(status);
        ipcRenderer.on('git:status-update', handler);
        // Return cleanup function
        return () => {
            ipcRenderer.removeListener('git:status-update', handler);
        };
    },
    // Event listeners for repository changes
    onRepositoryUpdated: (callback) => {
        const handler = (_event, updatedRepo) => callback(updatedRepo);
        ipcRenderer.on('repository:updated', handler);
        return () => {
            ipcRenderer.removeListener('repository:updated', handler);
        };
    },
    onRepositoryCloneAdded: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('repository:clone-added', handler);
        return () => {
            ipcRenderer.removeListener('repository:clone-added', handler);
        };
    },
    onRepositoryCloneRemoved: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('repository:clone-removed', handler);
        return () => {
            ipcRenderer.removeListener('repository:clone-removed', handler);
        };
    },
    onLocalCloneMissing: (callback) => {
        const handler = (_event, data) => callback(data);
        ipcRenderer.on('git:local-clone-missing', handler);
        return () => {
            ipcRenderer.removeListener('git:local-clone-missing', handler);
        };
    },
};
