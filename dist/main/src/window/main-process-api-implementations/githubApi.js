import { ipcRenderer } from 'electron';
import { GitHubAPIEvent } from '../../shared/main-process-api-interfaces/GitHubAPI';
export const githubAPI = {
    detectRepository: async (path) => {
        return ipcRenderer.invoke(GitHubAPIEvent.DETECT_REPOSITORY, path);
    },
    refreshData: async (owner, repo) => {
        return ipcRenderer.invoke(GitHubAPIEvent.REFRESH_DATA, owner, repo);
    },
    checkAuthStatus: async () => {
        return ipcRenderer.invoke(GitHubAPIEvent.CHECK_AUTH_STATUS);
    },
    getChangedFiles: async (directoryPath) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_CHANGED_FILES, directoryPath);
    },
    getMarkdownDocuments: async (owner, repo) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_MARKDOWN_DOCUMENTS, owner, repo);
    },
    getFileContent: async (owner, repo, path, ref) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_FILE_CONTENT, owner, repo, path, ref);
    },
    getFileAges: async (directoryPath) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_FILE_AGES, directoryPath);
    },
    getTree: async (owner, repo, ref) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_TREE, owner, repo, ref);
    },
    getIssues: async (owner, repo) => {
        return ipcRenderer.invoke(GitHubAPIEvent.GET_ISSUES, owner, repo);
    },
    createIssue: async (owner, repo, issue) => {
        return ipcRenderer.invoke(GitHubAPIEvent.CREATE_ISSUE, owner, repo, issue);
    },
    // Config fetching methods (formerly ConfigAPI)
    fetchRemoteConfig: async (request) => {
        return ipcRenderer.invoke(GitHubAPIEvent.FETCH_REMOTE_CONFIG, request);
    },
    fetchGitHubConfig: async (request) => {
        return ipcRenderer.invoke(GitHubAPIEvent.FETCH_GITHUB_CONFIG, request);
    },
};
