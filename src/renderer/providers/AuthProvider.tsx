/**
 * AuthProvider — the renderer's single auth source.
 *
 * Mount once, above `IntegratedShell`. It owns the only `useAuthState`
 * subscription in the window and fetches the signed-in user's full GitHub
 * profile once per session, then exposes both:
 *
 *  - `user`    — identity from the main-process auth state (gh CLI session)
 *  - `profile` — the full GitHub profile (login, avatar_url, bio, …)
 *
 * Surfaces read this instead of each calling `GithubService.getCurrentUser()`
 * (a GitHub API round-trip per mount) or spinning up their own `useAuthState`
 * subscription.
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { GitHubUser } from '../../shared/main-process-api-interfaces/GitHubAPI';
import { GithubService } from '../main-process-api/GithubService';
import { useAuthState, type AuthUser } from '../hooks/useAuthState';

export interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Identity from the gh-CLI-backed auth state. */
  user: AuthUser | null;
  /** Full GitHub profile for the signed-in user, or null when signed out. */
  profile: GitHubUser | null;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, user, isLoading, refresh } = useAuthState();
  const [profile, setProfile] = useState<GitHubUser | null>(null);

  const login = user?.login ?? null;

  // One profile fetch per session (re-run only when the signed-in user
  // changes). Consumers read `profile` rather than calling getCurrentUser.
  useEffect(() => {
    if (!isAuthenticated || !login) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    GithubService.getCurrentUser()
      .then((fetched) => {
        if (!cancelled) setProfile(fetched);
      })
      .catch((error) => {
        console.error('[AuthProvider] Failed to fetch GitHub profile:', error);
        if (!cancelled) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, login]);

  const value = useMemo<AuthContextValue>(
    () => ({ isAuthenticated, isLoading, user, profile, refresh }),
    [isAuthenticated, isLoading, user, profile, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuthUser(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthUser must be used within an AuthProvider');
  }
  return context;
}
