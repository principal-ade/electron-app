import { EventEmitter } from 'events';
import { GitSyncClient, SyncStatus } from './GitSyncClient';
interface ConnectionInfo {
    repoId: string;
    repoPath: string;
    branch: string;
    client: GitSyncClient;
    status: SyncStatus;
}
interface GitHubUser {
    githubHandle: string;
    email?: string;
    status: string;
    metadata?: any;
}
interface ConnectionManagerEvents {
    'connection-added': (repoId: string) => void;
    'connection-removed': (repoId: string) => void;
    'connection-status-changed': (repoId: string, status: SyncStatus) => void;
    'auth-changed': (authenticated: boolean, user?: GitHubUser) => void;
}
/**
 * Singleton service that manages persistent GitSync connections
 * Survives component mounting/unmounting and maintains connection state
 */
export declare class GitSyncConnectionManager extends EventEmitter {
    private static instance;
    private connections;
    private authUser;
    private authToken;
    private isAuthenticated;
    private constructor();
    static getInstance(): GitSyncConnectionManager;
    private initializeAuth;
    private setupIPCMessageForwarding;
    private subscribeToAuthChanges;
    /**
     * Clear authentication state
     */
    clearAuth(): void;
    /**
     * Get or create a connection for a repository
     */
    getConnection(repoPath: string, branch?: string, repository?: {
        owner?: string;
        name?: string;
        remoteUrl?: string;
    }): Promise<GitSyncClient | null>;
    /**
     * Set up proxy client to communicate through IPC instead of direct WebSocket
     */
    private setupProxyClient;
    /**
     * Set up event handlers for a client
     */
    private setupClientEventHandlers;
    /**
     * Update connection status
     */
    private updateConnectionStatus;
    /**
     * Get all active connections
     */
    getActiveConnections(): Map<string, ConnectionInfo>;
    /**
     * Get connection for a specific repo/branch
     */
    getExistingConnection(repoId: string, branch?: string): GitSyncClient | null;
    /**
     * Disconnect a specific connection
     */
    disconnectConnection(repoId: string, branch?: string): void;
    /**
     * Disconnect all connections
     */
    disconnectAll(): void;
    /**
     * Get current auth status
     */
    getAuthStatus(): {
        isAuthenticated: boolean;
        user: GitHubUser | null;
    };
    emit<K extends keyof ConnectionManagerEvents>(event: K, ...args: Parameters<ConnectionManagerEvents[K]>): boolean;
    on<K extends keyof ConnectionManagerEvents>(event: K, listener: ConnectionManagerEvents[K]): this;
    off<K extends keyof ConnectionManagerEvents>(event: K, listener: ConnectionManagerEvents[K]): this;
}
export declare const gitSyncConnectionManager: GitSyncConnectionManager;
export {};
//# sourceMappingURL=GitSyncConnectionManager.d.ts.map