/**
 * AuthContext (ported from web-ade) — thin adapter over the desktop app's auth.
 *
 * The ported page originally called the hosted app's `/api/auth/*`. The desktop
 * app already has auth (`useAuthState` → `AuthenticationService` → main
 * `AuthService`), so this just re-exposes that state in the shape the ported
 * components expect (`useAuth()` → `{ user, isAuthenticated, isLoading, … }`).
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useAuthUser } from '../../providers/AuthProvider';

export interface User {
  login: string;
  email: string;
  name: string;
  id: number;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  fetchUser: () => Promise<void>;
  /** Kept for API compatibility with the web-ade context. */
  refreshTokens: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Consume the app-wide AuthProvider rather than opening a second auth
  // subscription; repo-explorer only needs the identity shape.
  const { isAuthenticated, isLoading, user: authUser, profile } = useAuthUser();

  const value = useMemo<AuthContextType>(() => {
    const user: User | null = authUser
      ? {
          login: authUser.login,
          email: profile?.email ?? authUser.email ?? '',
          name: profile?.name ?? authUser.name ?? authUser.login,
          id: profile?.id ?? authUser.id ?? 0,
          avatar_url: profile?.avatar_url ?? authUser.avatarUrl,
        }
      : null;

    return {
      user,
      isAuthenticated,
      isLoading,
      fetchUser: async () => {},
      refreshTokens: async () => true,
    };
  }, [authUser, profile, isAuthenticated, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
