/**
 * useAuthState - React hook for subscribing to authentication state changes
 *
 * Provides real-time auth state updates across all renderer processes
 * by subscribing to IPC events from the main process AuthStateManager.
 *
 * Read-only: the app no longer performs its own login/logout. Auth is
 * derived from the GitHub CLI session (`gh auth token`) plus a fallback
 * stored token; this hook only mirrors that state for the UI.
 *
 * Now uses the unified AuthenticationAPI instead of direct IPC calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AuthUser,
  AuthState as APIAuthState,
} from '../../shared/main-process-api-interfaces/AuthenticationAPI';
import { AuthenticationService } from '../main-process-api/AuthenticationService';

// Extend the API AuthState with local UI state
export interface AuthState extends APIAuthState {
  isLoading: boolean;
}

// Re-export AuthUser for backward compatibility
export { AuthUser };

export interface UseAuthStateReturn extends AuthState {
  refresh: () => Promise<void>;
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

      setAuthState({ ...state, isLoading: false });
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

  // Re-read the current state from the main process on demand
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

  return {
    ...authState,
    refresh,
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
