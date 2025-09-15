/**
 * AuthStateManager - Centralized authentication state management
 *
 * Maintains a single source of truth for authentication state in the main process
 * and broadcasts changes to all renderer processes via IPC events.
 */
import { EventEmitter } from 'events';
export interface AuthUser {
    login: string;
    email: string;
    name?: string;
    id?: number;
    avatarUrl?: string;
}
export interface AuthState {
    isAuthenticated: boolean;
    user: AuthUser | null;
    token: string | null;
    lastChecked: number;
}
declare class AuthStateManager extends EventEmitter {
    private static instance;
    private state;
    private checkInterval;
    private readonly STATE_CHECK_INTERVAL;
    private constructor();
    static getInstance(): AuthStateManager;
    private setupHandlers;
    /**
     * Update the authentication state and broadcast to all windows
     */
    updateState(newState: Partial<AuthState>): void;
    /**
     * Set authenticated state with user and token
     */
    setAuthenticated(user: AuthUser, token: string): void;
    /**
     * Clear authentication state
     */
    clearAuthentication(): void;
    /**
     * Get the current state (without sensitive token)
     */
    getPublicState(): Omit<AuthState, 'token'>;
    /**
     * Get the full state (including token) - for internal use only
     */
    getFullState(): AuthState;
    /**
     * Broadcast state change to all renderer processes
     */
    private broadcastStateChange;
    /**
     * Start periodic auth state checks
     */
    startPeriodicChecks(checkCallback: () => Promise<void>): void;
    /**
     * Stop periodic auth state checks
     */
    stopPeriodicChecks(): void;
    /**
     * Check if authentication is still valid
     */
    isAuthenticationValid(): boolean;
}
export default AuthStateManager;
//# sourceMappingURL=AuthStateManager.d.ts.map