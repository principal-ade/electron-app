/**
 * useAuthState - React hook for subscribing to authentication state changes
 *
 * Provides real-time auth state updates across all renderer processes
 * by subscribing to IPC events from the main process AuthStateManager.
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */
import type { AuthUser, AuthState as APIAuthState } from '../../shared/main-process-api-interfaces/AuthenticationAPI';
export interface AuthState extends APIAuthState {
    isLoading: boolean;
    isLoggingIn?: boolean;
    loginError?: string | null;
}
export { AuthUser };
export interface UseAuthStateReturn extends AuthState {
    login: (forceRetry?: boolean) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    clearLoginError: () => void;
}
/**
 * Hook to subscribe to authentication state changes
 * Automatically syncs with main process auth state
 */
export declare function useAuthState(): UseAuthStateReturn;
/**
 * Simplified hook that just returns auth status and user
 */
export declare function useAuth(): {
    isAuthenticated: boolean;
    user: AuthUser | null;
    isLoading: boolean;
};
//# sourceMappingURL=useAuthState.d.ts.map