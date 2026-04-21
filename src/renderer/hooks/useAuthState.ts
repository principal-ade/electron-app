/**
 * useAuthState - React hook for subscribing to authentication state changes
 *
 * Provides real-time auth state updates across all renderer processes
 * by subscribing to IPC events from the main process AuthStateManager.
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AuthUser,
  AuthState as APIAuthState,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';
import { AuthenticationService } from '../main-process-api/AuthenticationService';

interface ErrorWithGuidance extends Error {
  guidance?: string;
}

// Extend the API AuthState with local UI state
export interface AuthState extends APIAuthState {
  isLoading: boolean;
  isLoggingIn?: boolean;
  loginError?: string | null;
  logoutError?: string | null;
  logoutGuidance?: string | null;
}

// Re-export AuthUser for backward compatibility
export { AuthUser };

export interface UseAuthStateReturn extends AuthState {
  login: (forceRetry?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearLoginError: () => void;
  clearLogoutError: () => void;
}

/**
 * Hook to subscribe to authentication state changes
 * Automatically syncs with main process auth state
 */
export function useAuthState(): UseAuthStateReturn {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    lastChecked: Date.now(),
    isLoading: true,
    isLoggingIn: false,
    loginError: null,
    logoutError: null,
    logoutGuidance: null,
  });

  const isSubscribed = useRef(false);

  // Subscribe to auth state changes
  useEffect(() => {
    // Prevent duplicate subscriptions
    if (isSubscribed.current) return;
    isSubscribed.current = true;

    console.info('[useAuthState] Subscribing to auth state changes');

    // Handler for auth state changes
    const handleAuthStateChange = (state: APIAuthState) => {
      console.info('[useAuthState] Auth state changed:', {
        isAuthenticated: state.isAuthenticated,
        user: state.user?.login,
      });

      setAuthState((prev) => ({
        ...state,
        isLoading: false,
        isLoggingIn: prev.isLoggingIn, // Preserve local login state
        loginError: prev.loginError, // Preserve local error state
        logoutError: prev.logoutError, // Preserve local logout error state
        logoutGuidance: prev.logoutGuidance, // Preserve local logout guidance
      }));
    };

    // Subscribe to auth state changes using the new API
    const unsubscribe = AuthenticationService.onAuthStateChanged(
      handleAuthStateChange,
    );

    // Get initial state
    AuthenticationService.getAuthState()
      .then((state) => {
        console.info('[useAuthState] Initial auth state:', {
          isAuthenticated: state.isAuthenticated,
          user: state.user?.login,
        });

        setAuthState({
          ...state,
          isLoading: false,
        });
      })
      .catch((error) => {
        console.error(
          '[useAuthState] Failed to get initial auth state:',
          error,
        );
        setAuthState((prev) => ({ ...prev, isLoading: false }));
      });

    // Cleanup on unmount
    return () => {
      console.info('[useAuthState] Unsubscribing from auth state changes');
      unsubscribe();
      isSubscribed.current = false;
    };
  }, []);

  // Login function
  const login = useCallback(
    async (forceRetry = false) => {
      if (authState.isLoggingIn && !forceRetry) {
        console.info('[useAuthState] Login already in progress');
        return;
      }

      try {
        setAuthState((prev) => ({
          ...prev,
          isLoggingIn: true,
          loginError: null,
        }));
        console.info('[useAuthState] Starting login...');

        const result = await AuthenticationService.login({
          forceNew: forceRetry,
        });

        if (result.success) {
          console.info('[useAuthState] Login successful:', result.user?.login);

          // Immediately update state with the result
          setAuthState((prev) => ({
            ...prev,
            isAuthenticated: true,
            user: result.user || null,
            isLoggingIn: false,
            loginError: null,
            lastChecked: Date.now(),
          }));

          // State will also be updated via the auth-state:changed event
        } else {
          const errorMsg = result.error || 'Login failed';
          console.error('[useAuthState] Login failed:', errorMsg);
          setAuthState((prev) => ({
            ...prev,
            isLoggingIn: false,
            loginError: errorMsg,
          }));
          throw new Error(errorMsg);
        }
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Login failed';
        console.error('[useAuthState] Login error:', errorMsg);
        setAuthState((prev) => ({
          ...prev,
          isLoggingIn: false,
          loginError: errorMsg,
        }));
        throw error;
      }
    },
    [authState.isLoggingIn],
  );

  // Logout function
  const logout = useCallback(async () => {
    try {
      console.info('[useAuthState] Logging out...');

      // Clear any previous logout errors
      setAuthState((prev) => ({
        ...prev,
        logoutError: null,
        logoutGuidance: null,
      }));

      const result = await AuthenticationService.logout();

      if (result.success) {
        console.info('[useAuthState] Logout successful');

        // Immediately clear the auth state
        setAuthState((prev) => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          isLoggingIn: false,
          loginError: null,
          logoutError: null,
          logoutGuidance: null,
          lastChecked: Date.now(),
        }));

        // State will also be updated via the auth-state:changed event
      } else {
        const errorMsg = result.error || 'Logout failed';
        console.error('[useAuthState] Logout failed:', errorMsg);

        // Store error and guidance in state for UI to display
        setAuthState((prev) => ({
          ...prev,
          logoutError: errorMsg,
          logoutGuidance: result.guidance || null,
        }));

        // Create detailed error for throwing
        const error: ErrorWithGuidance = new Error(errorMsg);
        if (result.guidance) {
          error.guidance = result.guidance;
        }
        throw error;
      }
    } catch (error) {
      console.error('[useAuthState] Logout error:', error);

      // Ensure error state is set even if exception occurs
      const errorMsg = error instanceof Error ? error.message : 'Logout failed';
      const guidance = (error as ErrorWithGuidance)?.guidance;

      setAuthState((prev) => ({
        ...prev,
        logoutError: errorMsg,
        logoutGuidance: guidance || null,
      }));

      throw error;
    }
  }, []);

  // Refresh auth state
  const refresh = useCallback(async () => {
    try {
      console.info('[useAuthState] Refreshing auth state...');

      const state = await AuthenticationService.getAuthState();

      setAuthState({
        ...state,
        isLoading: false,
      });

      console.info('[useAuthState] Auth state refreshed:', {
        isAuthenticated: state.isAuthenticated,
        user: state.user?.login,
      });
    } catch (error) {
      console.error('[useAuthState] Failed to refresh auth state:', error);
    }
  }, []);

  // Clear login error
  const clearLoginError = useCallback(() => {
    setAuthState((prev) => ({ ...prev, loginError: null }));
  }, []);

  // Clear logout error
  const clearLogoutError = useCallback(() => {
    setAuthState((prev) => ({
      ...prev,
      logoutError: null,
      logoutGuidance: null,
    }));
  }, []);

  return {
    ...authState,
    login,
    logout,
    refresh,
    clearLoginError,
    clearLogoutError,
  };
}

/**
 * Simplified hook that just returns auth status and user
 */
export function useAuth() {
  const { isAuthenticated, user, isLoading } = useAuthState();

  return {
    isAuthenticated,
    user,
    isLoading,
  };
}
