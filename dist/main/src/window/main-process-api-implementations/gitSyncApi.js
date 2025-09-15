import { ipcRenderer } from 'electron';
export var GitSyncEvent;
(function (GitSyncEvent) {
    GitSyncEvent["CONNECT"] = "git-sync:connect";
    GitSyncEvent["DISCONNECT"] = "git-sync:disconnect";
    GitSyncEvent["GET_STATUS"] = "git-sync:get-status";
    GitSyncEvent["SEND_MESSAGE"] = "git-sync:send-message";
    GitSyncEvent["GET_ROOM_TOKEN"] = "git-sync:get-room-token";
    GitSyncEvent["GET_SERVER_URL"] = "git-sync:get-server-url";
    GitSyncEvent["CHECK_REPO_ACCESS"] = "git-sync:check-repo-access";
    // Events (from main to renderer)
    GitSyncEvent["ON_MESSAGE"] = "git-sync:message";
})(GitSyncEvent || (GitSyncEvent = {}));
export const gitSyncAPI = {
    connect: (config) => ipcRenderer.invoke(GitSyncEvent.CONNECT, config),
    disconnect: (connectionId) => ipcRenderer.invoke(GitSyncEvent.DISCONNECT, connectionId),
    getStatus: (connectionId) => ipcRenderer.invoke(GitSyncEvent.GET_STATUS, connectionId),
    sendMessage: (message) => ipcRenderer.invoke(GitSyncEvent.SEND_MESSAGE, message),
    getRoomToken: (request) => ipcRenderer.invoke(GitSyncEvent.GET_ROOM_TOKEN, request),
    getServerUrl: () => ipcRenderer.invoke(GitSyncEvent.GET_SERVER_URL),
    checkRepoAccess: (repoUrl, token) => ipcRenderer.invoke(GitSyncEvent.CHECK_REPO_ACCESS, repoUrl, token),
    onMessage: (callback) => {
        const subscription = (_event, connectionKey, message) => callback(connectionKey, message);
        ipcRenderer.on(GitSyncEvent.ON_MESSAGE, subscription);
        return () => ipcRenderer.removeListener(GitSyncEvent.ON_MESSAGE, subscription);
    },
};
