import { GitSyncAPI } from '../../shared/main-process-api-interfaces/GitSyncAPI';
export declare enum GitSyncEvent {
    CONNECT = "git-sync:connect",
    DISCONNECT = "git-sync:disconnect",
    GET_STATUS = "git-sync:get-status",
    SEND_MESSAGE = "git-sync:send-message",
    GET_ROOM_TOKEN = "git-sync:get-room-token",
    GET_SERVER_URL = "git-sync:get-server-url",
    CHECK_REPO_ACCESS = "git-sync:check-repo-access",
    ON_MESSAGE = "git-sync:message"
}
export declare const gitSyncAPI: GitSyncAPI;
//# sourceMappingURL=gitSyncApi.d.ts.map